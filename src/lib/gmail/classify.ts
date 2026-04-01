import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { findOrCreateJobListing } from "@/lib/jobs/dedup";
import { extractJobsFromEmail } from "@/lib/jobs/extract-from-email";
import { parseSenderInfo } from "@/lib/gmail/utils";
import type { EmailClassification } from "@/lib/types/database";

const VALID_CLASSIFICATIONS: EmailClassification[] = [
  "rejection",
  "interview_invite",
  "followup",
  "offer",
  "general",
  "job_alert",
];

const JOB_KEYWORDS = [
  "application",
  "applied",
  "interview",
  "offer",
  "position",
  "role",
  "opportunity",
  "candidate",
  "hiring",
  "recruiter",
  "recruitment",
  "resume",
  "cv",
  "job",
  "career",
  "talent",
  "screening",
  "assessment",
  "onboarding",
  "rejected",
  "regret",
  "unfortunately",
  "congratulations",
  "next steps",
  "schedule",
  "shortlisted",
  "linkedin jobs",
  "indeed",
  "job alert",
  "new jobs",
  "jobs for you",
  "jobs matching",
  "recommended jobs",
  "job opportunities",
  "matching your profile",
  "jobs you might",
  "based on your profile",
  "weekly job",
  "daily job",
  "job digest",
];

function isJobRelatedEmail(subject: string, fromAddress: string): boolean {
  const text = `${subject} ${fromAddress}`.toLowerCase();
  return JOB_KEYWORDS.some((keyword) => text.includes(keyword));
}

export async function classifyEmails(userId: string): Promise<number> {
  const supabase = await createClient();
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Fetch unclassified emails
  const { data: emails, error } = await supabase
    .from("emails")
    .select("id, subject, from_address, body_preview")
    .eq("user_id", userId)
    .eq("classification", "unclassified")
    .order("received_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  if (!emails?.length) return 0;

  let classified = 0;

  for (const email of emails) {
    try {
      // Pre-filter: skip Claude API if email doesn't look job-related
      if (!isJobRelatedEmail(email.subject, email.from_address)) {
        await supabase
          .from("emails")
          .update({ classification: "general" })
          .eq("id", email.id);
        classified++;
        continue;
      }

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: `Classify this email related to job searching. Categories:
- rejection: The company is declining the application
- interview_invite: Invitation to interview (phone screen, video, onsite)
- followup: Follow-up or status update on the application
- offer: Job offer or offer-related communication
- job_alert: Job listing digest, job alert, or email containing job opportunities to review (e.g., LinkedIn "jobs for you", Indeed alerts, recruiter job suggestions)
- general: Job-related but doesn't fit above categories

Email subject: ${email.subject}
From: ${email.from_address}
Body: ${(email.body_preview ?? "").slice(0, 500)}

Respond with ONLY the category name, nothing else.`,
          },
        ],
      });

      const content = response.content[0];
      const classification =
        content.type === "text" ? content.text.trim().toLowerCase() : "";

      const finalClassification = VALID_CLASSIFICATIONS.includes(classification as EmailClassification)
        ? (classification as EmailClassification)
        : "general";

      await supabase
        .from("emails")
        .update({ classification: finalClassification })
        .eq("id", email.id);

      classified++;

      // Auto-extract for remembered sources
      // NOTE: if many job_alert emails are classified per cron run, each triggers a Sonnet API call.
      // Acceptable at current volume; should be batched if volume grows significantly.
      if (finalClassification === "job_alert") {
        try {
          const senderEmail = parseSenderInfo(email.from_address).email;

          const { data: source } = await supabase
            .from("job_email_sources")
            .select("id, total_extracted")
            .eq("user_id", userId)
            .eq("sender_email", senderEmail)
            .eq("is_auto_extract", true)
            .maybeSingle();

          if (source) {
            const result = await extractJobsFromEmail(supabase, email.id, userId);

            await supabase
              .from("job_email_sources")
              .update({ total_extracted: source.total_extracted + result.newCount + result.duplicateCount })
              .eq("id", source.id);
          }
        } catch (err) {
          // Never let auto-extract failure block classification
          console.error(`Auto-extract failed for email ${email.id}:`, err);
        }
      }

      // Second pass: extract job data for non-general emails and link to job_listings
      // Skip job_alert — those contain multiple jobs and handled above
      if (finalClassification !== "general" && finalClassification !== "job_alert") {
        try {
          const extractionResponse = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 200,
            messages: [{
              role: "user",
              content: `Extract the company name and job title/role from this job-related email. If you cannot determine them, return null for that field.

Subject: ${email.subject}
From: ${email.from_address}
Preview: ${(email.body_preview ?? "").slice(0, 300)}

Respond with ONLY valid JSON: {"company": "...", "title": "..."} or {"company": null, "title": null}`,
            }],
          });

          const extractContent = extractionResponse.content[0];
          if (extractContent.type === "text") {
            const extracted = JSON.parse(extractContent.text.trim()) as {
              company: string | null;
              title: string | null;
            };

            if (extracted.company && extracted.title) {
              // Extract first URL from body_preview
              const urlMatch = (email.body_preview ?? "").match(/https?:\/\/[^\s"'>]+/);
              const jobUrl = urlMatch ? urlMatch[0] : "";

              const dedupResult = await findOrCreateJobListing(supabase, {
                userId,
                title: extracted.title,
                company: extracted.company,
                url: jobUrl,
                source: "email",
              });

              // Link email to job listing
              await supabase
                .from("emails")
                .update({ job_listing_id: dedupResult.jobListingId })
                .eq("id", email.id);

              // If interview invite or offer, mark job as applied (implied we submitted an application)
              if (
                (finalClassification === "interview_invite" || finalClassification === "offer") &&
                !dedupResult.alreadyApplied
              ) {
                await supabase
                  .from("job_listings")
                  .update({
                    has_applied: true,
                    applied_at: new Date().toISOString(),
                    is_saved: true,
                  })
                  .eq("id", dedupResult.jobListingId);
              }
            }
          }
        } catch (extractErr) {
          console.error(`Failed to extract job data from email ${email.id}:`, extractErr);
          // Continue without linking — don't break the overall classify flow
        }
      }
    } catch (err) {
      console.error(`Error classifying email ${email.id}:`, err);
    }
  }

  // Auto-link emails after classification
  await autoLinkEmails(userId);

  return classified;
}

async function autoLinkEmails(userId: string): Promise<void> {
  const supabase = await createClient();

  // Get unlinked emails
  const { data: emails } = await supabase
    .from("emails")
    .select("id, from_address, to_address, subject, direction")
    .eq("user_id", userId)
    .is("application_id", null)
    .neq("classification", "unclassified")
    .neq("classification", "general")
    .limit(50);

  if (!emails?.length) return;

  // Get all user's applications
  const { data: applications } = await supabase
    .from("applications")
    .select("id, company, contact_email")
    .eq("user_id", userId);

  if (!applications?.length) return;

  for (const email of emails) {
    const senderDomain = extractDomain(
      email.direction === "inbound" ? email.from_address : email.to_address
    );
    if (!senderDomain) continue;

    // Try to match by domain or company name
    const match = applications.find((app) => {
      // Match by contact email domain
      if (app.contact_email) {
        const appDomain = extractDomain(app.contact_email);
        if (appDomain && senderDomain === appDomain) return true;
      }
      // Match by company name in domain
      const companyLower = app.company.toLowerCase().replace(/[^a-z0-9]/g, "");
      const domainLower = senderDomain.toLowerCase().replace(/[^a-z0-9]/g, "");
      return domainLower.includes(companyLower) || companyLower.includes(domainLower);
    });

    if (match) {
      await supabase
        .from("emails")
        .update({ application_id: match.id })
        .eq("id", email.id);

      // Create application event
      await supabase.from("application_events").insert({
        application_id: match.id,
        event_type:
          email.direction === "inbound" ? "email_received" : "email_sent",
        description: `Email: ${email.subject}`,
        metadata: { email_id: email.id },
      });
    }
  }
}

function extractDomain(emailOrAddress: string): string | null {
  // Handle "Name <email@domain.com>" format
  const match = emailOrAddress.match(/<([^>]+)>/);
  const email = match ? match[1] : emailOrAddress;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1].toLowerCase();
  // Skip common email providers
  const commonDomains = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "icloud.com",
    "protonmail.com",
  ];
  if (commonDomains.includes(domain)) return null;
  return domain;
}
