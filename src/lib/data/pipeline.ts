import { createClient } from '@/lib/supabase/server';
import type { JobListing, Application } from '@/lib/types/database';

export type PipelineStatus =
  | 'lead'
  | 'saved'
  | 'applied'
  | 'screening'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export type PipelineSource = 'email' | 'extension' | 'search' | 'manual';

export interface PipelineItem {
  // Identity
  jobListingId: string | null;
  applicationId: string | null;

  // Display
  title: string;
  company: string;
  location: string | null;
  remoteType: string | null;
  url: string | null;

  // Pipeline
  pipelineStatus: PipelineStatus;
  matchScore: number | null;
  matchReason: string | null;

  // Source tracking
  source: PipelineSource;
  sourceEmailId: string | null;
  autoApproved: boolean;
  autoApproveReason: string | null;

  // Dates
  foundAt: string;
  lastActivity: string;
  appliedAt: string | null;
  nextFollowupAt: string | null;

  // Application fields (null if still at lead stage)
  salaryRange: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  jobDescription: string | null;
  coverLetter: string | null;
}

export interface PipelineStats {
  total: number;
  byStatus: Record<PipelineStatus, number>;
}

const ATS_SOURCES = new Set([
  'greenhouse', 'lever', 'workday', 'teamtailor',
  'varbi', 'jobylon', 'reachmee', 'extension',
]);
const SEARCH_SOURCES = new Set(['platsbanken', 'adzuna']);

function deriveSource(listing: JobListing): PipelineSource {
  if (listing.source_email_id) return 'email';
  const sources = listing.all_sources?.length ? listing.all_sources : [listing.source];
  if (sources.some((s) => ATS_SOURCES.has(s))) return 'extension';
  if (sources.some((s) => SEARCH_SOURCES.has(s))) return 'search';
  return 'manual';
}

function derivePipelineStatus(listing: JobListing | null, app: Application | null): PipelineStatus {
  if (app) return app.status as PipelineStatus;
  if (!listing) return 'saved';
  if (listing.lead_status === 'pending') return 'lead';
  if (listing.lead_status === 'rejected') return 'rejected';
  return 'saved';
}

function listingToItem(listing: JobListing, app: Application | null): PipelineItem {
  const pipelineStatus = derivePipelineStatus(listing, app);
  const source = deriveSource(listing);

  return {
    jobListingId: listing.id,
    applicationId: app?.id ?? null,
    title: app?.role ?? listing.title,
    company: app?.company ?? listing.company,
    location: app?.location ?? listing.location ?? null,
    remoteType: (app?.remote_type ?? listing.remote_type ?? null) as string | null,
    url: app?.url ?? listing.url ?? null,
    pipelineStatus,
    matchScore: (listing.match_score ?? 0) > 0 ? listing.match_score : null,
    matchReason: listing.match_reason ?? null,
    source,
    sourceEmailId: listing.source_email_id ?? null,
    autoApproved: listing.auto_approved ?? false,
    autoApproveReason: listing.auto_approve_reason ?? null,
    foundAt: listing.created_at,
    lastActivity: app?.updated_at ?? listing.created_at,
    appliedAt: app?.applied_at ?? listing.applied_at ?? null,
    nextFollowupAt: app?.next_followup_at ?? null,
    salaryRange: app?.salary_range ?? null,
    contactName: app?.contact_name ?? null,
    contactEmail: app?.contact_email ?? null,
    notes: app?.notes ?? null,
    jobDescription: app?.job_description ?? listing.description ?? null,
    coverLetter: app?.cover_letter ?? null,
  };
}

function standaloneAppToItem(app: Application): PipelineItem {
  return {
    jobListingId: null,
    applicationId: app.id,
    title: app.role,
    company: app.company,
    location: app.location ?? null,
    remoteType: app.remote_type as string | null,
    url: app.url ?? null,
    pipelineStatus: app.status as PipelineStatus,
    matchScore: null,
    matchReason: null,
    source: 'manual',
    sourceEmailId: null,
    autoApproved: false,
    autoApproveReason: null,
    foundAt: app.created_at,
    lastActivity: app.updated_at,
    appliedAt: app.applied_at ?? null,
    nextFollowupAt: app.next_followup_at ?? null,
    salaryRange: app.salary_range ?? null,
    contactName: app.contact_name ?? null,
    contactEmail: app.contact_email ?? null,
    notes: app.notes ?? null,
    jobDescription: app.job_description ?? null,
    coverLetter: app.cover_letter ?? null,
  };
}

export async function getPipelineData(userId: string): Promise<PipelineItem[]> {
  const supabase = await createClient();

  const [listingsResult, appsResult] = await Promise.all([
    supabase
      .from('job_listings')
      .select('*')
      .eq('user_id', userId)
      .or('lead_status.not.is.null,is_saved.eq.true')
      .order('created_at', { ascending: false })
      .limit(300),
    supabase
      .from('applications')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
  ]);

  if (listingsResult.error) throw listingsResult.error;
  if (appsResult.error) throw appsResult.error;

  const listings = (listingsResult.data ?? []) as JobListing[];
  const allApps = (appsResult.data ?? []) as Application[];

  const listingIds = new Set(listings.map((l) => l.id));
  const appByListingId = new Map<string, Application>();
  const extraApps: Application[] = []; // apps with job_listing_id not in our listings query

  for (const app of allApps) {
    if (app.job_listing_id) {
      if (listingIds.has(app.job_listing_id)) {
        // Keep most recently updated app per listing (should be one, but guard)
        const existing = appByListingId.get(app.job_listing_id);
        if (!existing || new Date(app.updated_at) > new Date(existing.updated_at)) {
          appByListingId.set(app.job_listing_id, app);
        }
      } else {
        // App references a listing not in pipeline query — show it anyway
        extraApps.push(app);
      }
    }
    // Apps with no job_listing_id: handle below
  }

  const standaloneApps = allApps.filter((a) => !a.job_listing_id);

  return [
    ...listings.map((l) => listingToItem(l, appByListingId.get(l.id) ?? null)),
    ...standaloneApps.map(standaloneAppToItem),
    ...extraApps.map(standaloneAppToItem),
  ];
}

export async function getPipelineStats(userId: string): Promise<PipelineStats> {
  const items = await getPipelineData(userId);
  const byStatus: Record<PipelineStatus, number> = {
    lead: 0, saved: 0, applied: 0, screening: 0,
    interview: 0, offer: 0, rejected: 0, withdrawn: 0,
  };
  for (const item of items) byStatus[item.pipelineStatus]++;
  return { total: items.length, byStatus };
}
