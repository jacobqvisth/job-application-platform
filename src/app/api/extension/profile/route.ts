import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/supabase/extension-auth';
import { getPrimaryMarket } from '@/lib/data/markets';
import { getMarketConfig, DEFAULT_MARKET } from '@/lib/markets';
import type { ExtensionProfile, ExperienceItem } from '@/lib/types/database';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;

  // Fetch profile, user_profile_data, and primary market in parallel
  const [profileResult, profileDataResult, primaryMarket] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('user_profile_data').select('*').eq('user_id', userId).maybeSingle(),
    getPrimaryMarket(supabase, userId),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404, headers: CORS_HEADERS });
  }

  const p = profileResult.data;
  const pd = profileDataResult.data;

  // Derive first_name / last_name from full_name
  const fullName: string | null = p.full_name ?? null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  if (fullName) {
    const idx = fullName.indexOf(' ');
    if (idx === -1) {
      firstName = fullName;
    } else {
      firstName = fullName.slice(0, idx);
      lastName = fullName.slice(idx + 1);
    }
  }

  // Derive current_title / current_company from work_history
  let currentTitle: string | null = null;
  let currentCompany: string | null = null;
  if (pd?.work_history?.length) {
    const history: ExperienceItem[] = pd.work_history;
    // Prefer entries with no endDate (current), then sort by endDate desc
    const sorted = [...history].sort((a, b) => {
      const aIsCurrent = !a.endDate;
      const bIsCurrent = !b.endDate;
      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;
      // Both current or both have end dates — compare end dates or start dates
      const aDate = a.endDate ?? a.startDate ?? '';
      const bDate = b.endDate ?? b.startDate ?? '';
      return bDate.localeCompare(aDate);
    });
    if (sorted[0]) {
      currentTitle = sorted[0].title || null;
      currentCompany = sorted[0].company || null;
    }
  }

  const profile: ExtensionProfile = {
    user_id: userId,
    email: p.email,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    phone: pd?.phone ?? null,
    address_line1: pd?.address_line1 ?? null,
    postal_code: pd?.postal_code ?? null,
    city: pd?.city ?? null,
    country: pd?.country ?? null,
    linkedin_url: pd?.linkedin_url ?? null,
    website_url: pd?.website_url ?? null,
    github_url: pd?.github_url ?? null,
    current_title: currentTitle,
    current_company: currentCompany,
    summary: pd?.summary ?? null,
  };

  const marketCode = primaryMarket?.market_code ?? DEFAULT_MARKET;
  const marketConfig = getMarketConfig(marketCode);

  return NextResponse.json(
    {
      success: true,
      profile,
      market: {
        code: marketCode,
        name: marketConfig?.name ?? marketCode,
        flag: marketConfig?.flag ?? '',
        language: primaryMarket?.language_preference ?? marketConfig?.defaultLanguage ?? 'en',
        currency: primaryMarket?.salary_currency ?? marketConfig?.currency ?? 'SEK',
        atsAdapters: marketConfig?.atsAdapters ?? [],
        applicationNorms: marketConfig?.applicationNorms ?? null,
      },
    },
    { headers: CORS_HEADERS }
  );
}
