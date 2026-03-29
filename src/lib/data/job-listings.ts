import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { JobListing } from '@/lib/types/database';

export async function getNewJobListings(
  userId: string,
  limit = 20
): Promise<JobListing[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_listings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_saved', false)
    .order('match_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as JobListing[];
}

export async function markJobListingSaved(
  userId: string,
  externalId: string,
  source: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('job_listings')
    .update({ is_saved: true })
    .eq('user_id', userId)
    .eq('external_id', externalId)
    .eq('source', source);
}

export async function getJobListingsCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from('job_listings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_saved', false);
  return count ?? 0;
}

interface JobListingInsert {
  user_id: string;
  saved_search_id: string | null;
  external_id: string;
  source: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  remote_type: string | null;
  posted_at: string | null;
  match_score: number;
  // JobTechDev-enriched fields (optional)
  ats_type?: string | null;
  apply_url?: string | null;
  occupation?: string | null;
  occupation_field?: string | null;
  employment_type?: string | null;
  deadline?: string | null;
  required_skills?: string[] | null;
  number_of_vacancies?: number | null;
}

// For cron: bulk upsert listings — skip on conflict (don't overwrite is_saved)
export async function upsertJobListings(listings: JobListingInsert[]): Promise<void> {
  if (listings.length === 0) return;
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase
    .from('job_listings')
    .upsert(listings, {
      onConflict: 'user_id,external_id,source',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}
