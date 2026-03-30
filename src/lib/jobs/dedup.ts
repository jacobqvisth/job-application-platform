/**
 * Universal Job Deduplication Service
 *
 * Provides normalization and find-or-create logic for job_listings.
 * All job ingest paths (extension, chat, cron, screenshot) funnel through here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Normalization ────────────────────────────────────────────────────────────

const COMPANY_SUFFIXES = /\s+(AB|Ltd|Limited|Inc|Corp|Corporation|LLC|GmbH|AS|ApS|SAS|BV|NV|SA|PLC|Plc|Group|Holding|Holdings)\s*$/gi;
const COMPANY_STRIP_CHARS = /[&,.]/g;

export function normalizeCompany(name: string): string {
  return name
    .replace(COMPANY_SUFFIXES, '')
    .replace(COMPANY_STRIP_CHARS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const TITLE_SENIOR = /\b(sr\.?|senior)\b/gi;
const TITLE_JUNIOR = /\b(jr\.?|junior)\b/gi;
const TITLE_ENGINEER = /\b(engineer|programmer|dev|developer)\b/gi;
const TITLE_FRONTEND = /\b(front-end|front end|frontend)\b/gi;
const TITLE_BACKEND = /\b(back-end|back end|backend)\b/gi;
const TITLE_FULLSTACK = /\b(full-stack|full stack|fullstack)\b/gi;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(TITLE_SENIOR, 'senior')
    .replace(TITLE_JUNIOR, 'junior')
    .replace(TITLE_FRONTEND, 'frontend')
    .replace(TITLE_BACKEND, 'backend')
    .replace(TITLE_FULLSTACK, 'fullstack')
    .replace(TITLE_ENGINEER, 'developer')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeFingerprint(company: string, title: string): string {
  return `${normalizeCompany(company)}::${normalizeTitle(title)}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type JobSource =
  | 'platsbanken'
  | 'jobtechdev'
  | 'linkedin'
  | 'teamtailor'
  | 'varbi'
  | 'jobylon'
  | 'reachmee'
  | 'greenhouse'
  | 'lever'
  | 'workday'
  | 'adzuna'
  | 'email'
  | 'screenshot'
  | 'manual';

export interface FindOrCreateParams {
  userId: string;
  title: string;
  company: string;
  url: string;
  source: JobSource;
  externalId?: string;
  description?: string;
  location?: string;
  postedAt?: string;
  deadline?: string;
  salaryMin?: number;
  salaryMax?: number;
  remoteType?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
  rawData?: Record<string, unknown>;
}

export interface FindOrCreateResult {
  jobListingId: string;
  isNew: boolean;
  isNewSource: boolean;
  alreadyApplied: boolean;
  appliedAt?: string | null;
  applicationId?: string | null;
  matchType: 'exact_id' | 'fingerprint' | 'new';
  warningMessage?: string;
}

// ─── Find or Create ───────────────────────────────────────────────────────────

export async function findOrCreateJobListing(
  supabase: SupabaseClient,
  params: FindOrCreateParams
): Promise<FindOrCreateResult> {
  const {
    userId, title, company, url, source, externalId,
    description, location, postedAt, deadline,
    salaryMin, salaryMax, remoteType, rawData,
  } = params;

  const companyNorm = normalizeCompany(company);
  const titleNorm = normalizeTitle(title);
  const fingerprint = `${companyNorm}::${titleNorm}`;

  // ── 1. Exact external ID match ────────────────────────────────────────────
  if (externalId) {
    const { data: exactMatch } = await supabase
      .from('job_listings')
      .select('id, has_applied, applied_at, application_id, all_sources, all_urls')
      .eq('user_id', userId)
      .eq('external_id', externalId)
      .eq('source', source)
      .maybeSingle();

    if (exactMatch) {
      await addSourceEntry(supabase, exactMatch.id, userId, source, externalId, url, rawData);
      await updateListingArrays(supabase, exactMatch.id, url, source);

      return {
        jobListingId: exactMatch.id,
        isNew: false,
        isNewSource: false,
        alreadyApplied: exactMatch.has_applied ?? false,
        appliedAt: exactMatch.applied_at,
        applicationId: exactMatch.application_id,
        matchType: 'exact_id',
        warningMessage: exactMatch.has_applied
          ? `You already applied to this job on ${formatDate(exactMatch.applied_at)}`
          : undefined,
      };
    }
  }

  // ── 2. Fingerprint match (same company + title, different platform) ────────
  const { data: fpMatch } = await supabase
    .from('job_listings')
    .select('id, has_applied, applied_at, application_id, all_sources, source')
    .eq('user_id', userId)
    .eq('dedup_fingerprint', fingerprint)
    .maybeSingle();

  if (fpMatch) {
    const isNewSource = !(fpMatch.all_sources ?? []).includes(source);
    await addSourceEntry(supabase, fpMatch.id, userId, source, externalId, url, rawData);
    await updateListingArrays(supabase, fpMatch.id, url, source);

    let warningMessage: string | undefined;
    if (fpMatch.has_applied) {
      warningMessage = `You already applied to this job on ${formatDate(fpMatch.applied_at)}`;
    } else if (isNewSource) {
      const existingSources = (fpMatch.all_sources ?? [fpMatch.source]) as string[];
      warningMessage = `You've already saved this job from ${existingSources.join(', ')}`;
    }

    return {
      jobListingId: fpMatch.id,
      isNew: false,
      isNewSource,
      alreadyApplied: fpMatch.has_applied ?? false,
      appliedAt: fpMatch.applied_at,
      applicationId: fpMatch.application_id,
      matchType: 'fingerprint',
      warningMessage,
    };
  }

  // ── 3. Create new canonical job listing ───────────────────────────────────
  const { data: newListing, error } = await supabase
    .from('job_listings')
    .insert({
      user_id: userId,
      external_id: externalId ?? `manual_${Date.now()}`,
      source,
      title,
      company,
      company_normalized: companyNorm,
      title_normalized: titleNorm,
      dedup_fingerprint: fingerprint,
      url,
      description: description ?? null,
      location: location ?? null,
      posted_at: postedAt ?? null,
      deadline: deadline ?? null,
      salary_min: salaryMin ?? null,
      salary_max: salaryMax ?? null,
      remote_type: remoteType ?? null,
      all_sources: [source],
      all_urls: [url],
      is_saved: false,
      has_applied: false,
      match_score: 0,
    })
    .select('id')
    .single();

  if (error || !newListing) {
    throw new Error(`Failed to create job listing: ${error?.message}`);
  }

  await addSourceEntry(supabase, newListing.id, userId, source, externalId, url, rawData);

  return {
    jobListingId: newListing.id,
    isNew: true,
    isNewSource: true,
    alreadyApplied: false,
    matchType: 'new',
  };
}

// ─── Mark as Applied ──────────────────────────────────────────────────────────

export async function markJobListingAsApplied(
  supabase: SupabaseClient,
  jobListingId: string,
  applicationId: string,
  appliedAt?: string
): Promise<void> {
  await supabase
    .from('job_listings')
    .update({
      has_applied: true,
      applied_at: appliedAt ?? new Date().toISOString(),
      application_id: applicationId,
      is_saved: true,
    })
    .eq('id', jobListingId);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function addSourceEntry(
  supabase: SupabaseClient,
  jobListingId: string,
  userId: string,
  source: string,
  externalId: string | undefined,
  url: string,
  rawData?: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('job_listing_sources')
    .upsert(
      {
        job_listing_id: jobListingId,
        user_id: userId,
        source,
        external_id: externalId ?? null,
        source_url: url,
        raw_data: rawData ?? {},
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'job_listing_id,source', ignoreDuplicates: false }
    );
}

async function updateListingArrays(
  supabase: SupabaseClient,
  jobListingId: string,
  url: string,
  source: string
): Promise<void> {
  await supabase.rpc('append_job_listing_source', {
    p_job_listing_id: jobListingId,
    p_source: source,
    p_url: url,
  });
}

function formatDate(isoString?: string | null): string {
  if (!isoString) return 'a previous date';
  return new Date(isoString).toLocaleDateString('en-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
