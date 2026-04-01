import { createClient } from '@/lib/supabase/server';
import type { JobListing, JobEmailSource, LeadStatus } from '@/lib/types/database';

export interface JobLeadFilters {
  status?: LeadStatus | 'all';
  source?: 'email' | 'search' | 'all';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface JobLeadStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export async function getJobLeads(
  userId: string,
  filters: JobLeadFilters = {}
): Promise<JobListing[]> {
  const supabase = await createClient();
  let query = supabase
    .from('job_listings')
    .select('*')
    .eq('user_id', userId)
    .not('lead_status', 'is', null)
    .order('created_at', { ascending: false });

  if (filters.status && filters.status !== 'all') {
    query = query.eq('lead_status', filters.status);
  }

  if (filters.source && filters.source !== 'all') {
    if (filters.source === 'email') {
      query = query.not('source_email_id', 'is', null);
    } else {
      query = query.is('source_email_id', null);
    }
  }

  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
    );
  }

  if (filters.limit) query = query.limit(filters.limit);
  if (filters.offset)
    query = query.range(
      filters.offset,
      filters.offset + (filters.limit ?? 50) - 1
    );

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as JobListing[];
}

export async function getJobLeadStats(userId: string): Promise<JobLeadStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_listings')
    .select('lead_status')
    .eq('user_id', userId)
    .not('lead_status', 'is', null);

  if (error) throw error;

  const items = data ?? [];
  return {
    total: items.length,
    pending: items.filter((i) => i.lead_status === 'pending').length,
    approved: items.filter((i) => i.lead_status === 'approved').length,
    rejected: items.filter((i) => i.lead_status === 'rejected').length,
  };
}

export async function getJobEmailSources(userId: string): Promise<JobEmailSource[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('job_email_sources')
    .select('*')
    .eq('user_id', userId)
    .order('total_extracted', { ascending: false });

  if (error) throw error;
  return (data ?? []) as JobEmailSource[];
}
