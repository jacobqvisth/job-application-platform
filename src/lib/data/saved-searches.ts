import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { SavedSearch, CreateSavedSearchData } from '@/lib/types/database';

export async function getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedSearch[];
}

export async function createSavedSearch(
  userId: string,
  data: CreateSavedSearchData
): Promise<SavedSearch> {
  const supabase = await createClient();
  const { data: result, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: userId, ...data })
    .select()
    .single();
  if (error) throw error;
  return result as SavedSearch;
}

export async function deleteSavedSearch(userId: string, searchId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('saved_searches')
    .delete()
    .eq('id', searchId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function updateSavedSearchLastRun(searchId: string): Promise<void> {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await supabase
    .from('saved_searches')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', searchId);
  if (error) throw error;
}

// For cron: get all active searches across all users (admin/service role)
export async function getAllActiveSavedSearches(): Promise<SavedSearch[]> {
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data, error } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as SavedSearch[];
}
