import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserMarketSetting, MarketPreferences } from '@/lib/types/database';
import { DEFAULT_MARKET } from '@/lib/markets';

export async function getUserMarkets(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMarketSetting[]> {
  const { data, error } = await supabase
    .from('user_market_settings')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return (data ?? []) as UserMarketSetting[];
}

export async function getPrimaryMarket(
  supabase: SupabaseClient,
  userId: string
): Promise<UserMarketSetting | null> {
  const { data } = await supabase
    .from('user_market_settings')
    .select('*')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  return (data as UserMarketSetting | null) ?? null;
}

export async function addUserMarket(
  supabase: SupabaseClient,
  userId: string,
  marketCode: string,
  isPrimary = false
): Promise<void> {
  const code = marketCode.toUpperCase();

  // If setting as primary, clear existing primary first
  if (isPrimary) {
    await supabase
      .from('user_market_settings')
      .update({ is_primary: false })
      .eq('user_id', userId)
      .eq('is_primary', true);
  }

  const { error } = await supabase.from('user_market_settings').upsert(
    {
      user_id: userId,
      market_code: code,
      is_primary: isPrimary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,market_code' }
  );

  if (error) throw error;
}

export async function removeUserMarket(
  supabase: SupabaseClient,
  userId: string,
  marketCode: string
): Promise<void> {
  const code = marketCode.toUpperCase();

  const { error } = await supabase
    .from('user_market_settings')
    .delete()
    .eq('user_id', userId)
    .eq('market_code', code);

  if (error) throw error;
}

export async function setPrimaryMarket(
  supabase: SupabaseClient,
  userId: string,
  marketCode: string
): Promise<void> {
  const code = marketCode.toUpperCase();

  // Clear existing primary
  await supabase
    .from('user_market_settings')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('is_primary', true);

  // Set new primary
  const { error } = await supabase
    .from('user_market_settings')
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('market_code', code);

  if (error) throw error;
}

export async function updateMarketPreferences(
  supabase: SupabaseClient,
  userId: string,
  marketCode: string,
  prefs: Partial<MarketPreferences>
): Promise<void> {
  const code = marketCode.toUpperCase();

  const { error } = await supabase
    .from('user_market_settings')
    .update({ ...prefs, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('market_code', code);

  if (error) throw error;
}

/**
 * Ensure a user has at least a default market (Sweden).
 * Called at first login / auth callback.
 */
export async function ensureUserMarket(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const existing = await getPrimaryMarket(supabase, userId);
  if (existing) return;

  const { error } = await supabase.from('user_market_settings').insert({
    user_id: userId,
    market_code: DEFAULT_MARKET,
    is_primary: true,
    language_preference: 'sv',
    salary_currency: 'SEK',
    resume_format: 'swedish',
  });

  // Ignore unique-constraint conflicts (concurrent requests)
  if (error && !error.message.includes('unique')) {
    throw error;
  }
}
