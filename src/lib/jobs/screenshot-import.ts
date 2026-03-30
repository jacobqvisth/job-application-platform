/**
 * Screenshot Import Service
 *
 * Core logic for extracting job applications from a screenshot using Claude Vision.
 * Shared between the /api/jobs/import-screenshot route and the importJobScreenshot chat tool.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findOrCreateJobListing, markJobListingAsApplied } from "@/lib/jobs/dedup";

export interface ImportedJob {
  jobListingId: string;
  company: string;
  title: string;
  location?: string | null;
  status: string;
  appliedDate?: string | null;
  platform?: string | null;
  isNew: boolean;
  alreadyApplied: boolean;
  applicationId?: string;
  warningMessage?: string;
}

export interface ScreenshotImportResult {
  importedCount: number;
  jobs: ImportedJob[];
  errorMessage?: string;
}

interface ExtractedJob {
  company: string | null;
  title: string | null;
  location?: string | null;
  status?: string | null;
  appliedDate?: string | null;
  platform?: string | null;
}

export async function processScreenshotImport(
  supabase: SupabaseClient,
  userId: string,
  imageBase64: string,
  mimeType: "image/png" | "image/jpeg" | "image/webp"
): Promise<ScreenshotImportResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Step 1: Extract jobs from screenshot using Claude Vision
  let extractedJobs: ExtractedJob[] = [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `This is a screenshot of job applications (from LinkedIn, an email, or a job platform).

Extract ALL job applications visible in this screenshot. For each job, extract:
- company: company name
- title: job title/role
- location: location if visible (or null)
- status: one of "applied", "seen", "interviewing", "rejected", "unknown"
- appliedDate: date applied in ISO format if visible (or null)
- platform: detected platform ('linkedin', 'platsbanken', 'teamtailor', etc.) or null

Respond with ONLY valid JSON: { "jobs": [...] }
If no jobs are visible, return { "jobs": [] }`,
            },
          ],
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const clean = content.text
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      const parsed = JSON.parse(clean) as { jobs: ExtractedJob[] };
      extractedJobs = parsed.jobs ?? [];
    }
  } catch (err) {
    console.error("Claude Vision extraction failed:", err);
    return {
      importedCount: 0,
      jobs: [],
      errorMessage: "Failed to analyze screenshot. Please try a clearer image.",
    };
  }

  if (extractedJobs.length === 0) {
    return {
      importedCount: 0,
      jobs: [],
      errorMessage: "No job applications found in this screenshot.",
    };
  }

  // Step 2: Dedup + create job listings / applications
  const importedJobs: ImportedJob[] = [];

  for (const job of extractedJobs) {
    if (!job.company || !job.title) continue;

    try {
      const dedupResult = await findOrCreateJobListing(supabase, {
        userId,
        title: job.title,
        company: job.company,
        url: "",
        source: "screenshot",
        location: job.location ?? undefined,
        postedAt: job.appliedDate ?? undefined,
        rawData: {
          platform: job.platform,
          status: job.status,
          screenshotImported: true,
        },
      });

      const isApplied = job.status === "applied" || job.status === "interviewing";

      let applicationId: string | undefined;

      if (isApplied && !dedupResult.alreadyApplied) {
        // Create application record
        const appStatus = job.status === "interviewing" ? "screening" : "applied";
        const { data: newApp } = await supabase
          .from("applications")
          .insert({
            user_id: userId,
            company: job.company,
            role: job.title,
            url: null,
            location: job.location ?? null,
            status: appStatus,
            applied_at: job.appliedDate ?? new Date().toISOString(),
            job_listing_id: dedupResult.jobListingId,
          })
          .select("id")
          .single();

        if (newApp) {
          applicationId = newApp.id;
          await markJobListingAsApplied(
            supabase,
            dedupResult.jobListingId,
            newApp.id,
            job.appliedDate ?? undefined
          );
        }
      } else if (dedupResult.applicationId) {
        applicationId = dedupResult.applicationId;
      }

      importedJobs.push({
        jobListingId: dedupResult.jobListingId,
        company: job.company,
        title: job.title,
        location: job.location,
        status: job.status ?? "unknown",
        appliedDate: job.appliedDate,
        platform: job.platform,
        isNew: dedupResult.isNew,
        alreadyApplied: dedupResult.alreadyApplied,
        applicationId,
        warningMessage: dedupResult.warningMessage,
      });
    } catch (err) {
      console.error(`Failed to process extracted job ${job.company} / ${job.title}:`, err);
      // Skip this job but continue processing others
    }
  }

  return {
    importedCount: importedJobs.filter((j) => j.isNew || (!j.alreadyApplied && j.applicationId)).length,
    jobs: importedJobs,
  };
}
