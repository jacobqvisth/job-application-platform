import { SupabaseClient } from '@supabase/supabase-js';
import type {
  ApplicationPackage,
  PackageStatus,
  JobAnalysis,
  CompanyResearch,
  Checkpoint1Edits,
  AiUsage,
} from '@/lib/types/database';

export async function createPackage(
  supabase: SupabaseClient,
  userId: string,
  jobListingId: string
): Promise<ApplicationPackage> {
  const { data, error } = await supabase
    .from('application_packages')
    .insert({ user_id: userId, job_listing_id: jobListingId, status: 'analyzing' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPackage(
  supabase: SupabaseClient,
  packageId: string,
  userId: string
): Promise<ApplicationPackage | null> {
  const { data, error } = await supabase
    .from('application_packages')
    .select('*')
    .eq('id', packageId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updatePackage(
  supabase: SupabaseClient,
  packageId: string,
  userId: string,
  updates: Partial<{
    status: PackageStatus;
    job_analysis: JobAnalysis;
    company_research: CompanyResearch;
    checkpoint_1_edits: Checkpoint1Edits;
    ai_usage: AiUsage;
  }>
): Promise<ApplicationPackage> {
  const { data, error } = await supabase
    .from('application_packages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', packageId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listPackages(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: PackageStatus; limit?: number }
): Promise<ApplicationPackage[]> {
  let query = supabase
    .from('application_packages')
    .select('*, job_listings(title, company, location, match_score)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (options?.status) query = query.eq('status', options.status);
  if (options?.limit) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}
