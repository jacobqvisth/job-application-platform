// Shared extraction logic — used by both the API route and auto-extraction in classify.ts

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateJobListing } from '@/lib/jobs/dedup';
import { scoreUnscoredJobsForUser } from '@/lib/jobs/ai-score';

const anthropic = new Anthropic();

interface ExtractedJob {
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  description: string | null;
  salary_min: number | null;
  salary_max: number | null;
  remote_type: 'remote' | 'hybrid' | 'onsite' | null;
}

async function callExtractionPrompt(
  emailBody: string,
  subject: string,
  fromAddress: string
): Promise<ExtractedJob[]> {
  const extractionPrompt = `You are extracting individual job listings from an email digest or job alert.

Extract EVERY distinct job opportunity mentioned in this email. For each job, extract:
- title: The job title/role (required)
- company: The hiring company name (required)
- location: City, country, or "Remote" (if mentioned, otherwise null)
- url: The direct link to view or apply to the job (if present in the HTML, otherwise null)
- description: A brief 1-2 sentence summary of the role (if available, otherwise null)
- salary_min: Minimum salary as a number (if mentioned, otherwise null)
- salary_max: Maximum salary as a number (if mentioned, otherwise null)
- remote_type: "remote", "hybrid", "onsite", or null (if not clear)

Rules:
- Only extract REAL job listings, not ads, promotional content, or "tips for your search"
- If the email is not a job digest/alert or contains no job listings, return an empty array
- Preserve original URLs exactly — do not modify, shorten, or reconstruct them
- If a URL is wrapped in a tracking redirect (common in email), preserve the full tracking URL
- If company name is unclear, extract the best guess from context
- Each job should be a separate object even if multiple roles at the same company
- salary_min and salary_max should be annual amounts as numbers (e.g., 600000 for 600,000 SEK), or null

Email subject: ${subject}
From: ${fromAddress}

Email body:
${emailBody.slice(0, 50000)}

Respond with ONLY a JSON array. No other text, no markdown formatting, no code blocks.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: extractionPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  // Strip markdown code blocks if present
  const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  // Extract JSON array
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in extraction response');
  const jobs = JSON.parse(match[0]);
  return jobs;
}

export interface ExtractionResult {
  newCount: number;
  duplicateCount: number;
  extractedIds: string[];
}

export async function extractJobsFromEmail(
  supabase: SupabaseClient,
  emailId: string,
  userId: string
): Promise<ExtractionResult> {
  // Fetch the email, verify ownership
  const { data: email, error: emailError } = await supabase
    .from('emails')
    .select('id, user_id, subject, from_address, body_html, body_text')
    .eq('id', emailId)
    .eq('user_id', userId)
    .maybeSingle();

  if (emailError || !email) {
    return { newCount: 0, duplicateCount: 0, extractedIds: [] };
  }

  // Idempotency: check for already-extracted listings by source_email_id
  const { data: existingListings } = await supabase
    .from('job_listings')
    .select('id')
    .eq('source_email_id', emailId)
    .eq('user_id', userId);

  if (existingListings && existingListings.length > 0) {
    return {
      newCount: 0,
      duplicateCount: existingListings.length,
      extractedIds: existingListings.map((l: { id: string }) => l.id),
    };
  }

  // Pick email body: prefer HTML (has links), fall back to plain text
  const emailBody: string = email.body_html || email.body_text || '';
  if (!emailBody) {
    return { newCount: 0, duplicateCount: 0, extractedIds: [] };
  }

  // Call Claude Sonnet — retry once on JSON parse failure
  let jobs: ExtractedJob[] = [];
  try {
    jobs = await callExtractionPrompt(emailBody, email.subject, email.from_address);
  } catch {
    // Retry once
    jobs = await callExtractionPrompt(emailBody, email.subject, email.from_address);
  }

  // Filter out jobs missing required fields
  const validJobs = jobs.filter(
    (j) => j.title && typeof j.title === 'string' && j.company && typeof j.company === 'string'
  );

  const extractedIds: string[] = [];
  let newCount = 0;
  let duplicateCount = 0;

  for (const job of validJobs) {
    try {
      const result = await findOrCreateJobListing(supabase, {
        userId,
        title: job.title,
        company: job.company,
        url: job.url || '',
        source: 'email',
        description: job.description || undefined,
        location: job.location || undefined,
        remoteType: job.remote_type || undefined,
        salaryMin: job.salary_min || undefined,
        salaryMax: job.salary_max || undefined,
      });

      if (result.isNew) {
        await supabase
          .from('job_listings')
          .update({ lead_status: 'pending', source_email_id: emailId })
          .eq('id', result.jobListingId);
        newCount++;
      } else {
        const { data: existing } = await supabase
          .from('job_listings')
          .select('lead_status')
          .eq('id', result.jobListingId)
          .single();

        const existingLeadStatus = existing?.lead_status ?? null;
        await supabase
          .from('job_listings')
          .update({
            source_email_id: emailId,
            ...(existingLeadStatus === null ? { lead_status: 'pending' } : {}),
          })
          .eq('id', result.jobListingId)
          .is('source_email_id', null);
        duplicateCount++;
      }

      extractedIds.push(result.jobListingId);
    } catch (err) {
      console.error(`Failed to process job "${job.title}" at "${job.company}":`, err);
    }
  }

  // Fire-and-forget AI scoring on newly extracted listings
  scoreUnscoredJobsForUser(userId, supabase).catch(console.error);

  return { newCount, duplicateCount, extractedIds };
}
