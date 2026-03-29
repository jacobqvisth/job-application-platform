'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  addUserMarket,
  removeUserMarket,
  setPrimaryMarket,
  updateMarketPreferences,
} from '@/lib/data/markets';
import { getSupportedMarketCodes } from '@/lib/markets';
import type { MarketPreferences } from '@/lib/types/database';

async function getAuthenticatedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return { supabase, user };
}

export async function addMarketAction(marketCode: string) {
  const { supabase, user } = await getAuthenticatedUser();

  if (!getSupportedMarketCodes().includes(marketCode.toUpperCase())) {
    throw new Error(`Unsupported market: ${marketCode}`);
  }

  await addUserMarket(supabase, user.id, marketCode);
  revalidatePath('/dashboard/settings');
}

export async function removeMarketAction(marketCode: string) {
  const { supabase, user } = await getAuthenticatedUser();
  await removeUserMarket(supabase, user.id, marketCode);
  revalidatePath('/dashboard/settings');
}

export async function setPrimaryMarketAction(marketCode: string) {
  const { supabase, user } = await getAuthenticatedUser();
  await setPrimaryMarket(supabase, user.id, marketCode);
  revalidatePath('/dashboard/settings');
}

export async function updateMarketPreferencesAction(
  marketCode: string,
  prefs: Partial<MarketPreferences>
) {
  const { supabase, user } = await getAuthenticatedUser();
  await updateMarketPreferences(supabase, user.id, marketCode, prefs);
  revalidatePath('/dashboard/settings');
}
