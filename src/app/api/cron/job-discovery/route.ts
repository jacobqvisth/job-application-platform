import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAllActiveSavedSearches, updateSavedSearchLastRun } from '@/lib/data/saved-searches';
import { upsertJobListings } from '@/lib/data/job-listings';
import { computeMatchScore } from '@/lib/utils/match-score';
import type { UserProfileData, SavedSearch } from '@/lib/types/database';

const MIN_MATCH_SCORE = 40;

function detectRemoteType(
  title: string,
  location: string,
  description: string
): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  const text = `${title} ${location} ${description}`.toLowerCase();
  if (text.includes('remote')) return 'remote';
  if (text.includes('hybrid')) return 'hybrid';
  return 'unknown';
}

async function searchAdzuna(search: SavedSearch, page = 1) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;

  const country = search.country || 'gb';
  const whatQuery = search.remote_only ? `remote ${search.query}` : search.query;
  const whereQuery =
    search.remote_only && !search.location ? 'remote' : search.location ?? '';

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('what', whatQuery);
  url.searchParams.set('results_per_page', '20');
  url.searchParams.set('full_time', '1');
  if (whereQuery) url.searchParams.set('where', whereQuery);
  if (search.salary_min) url.searchParams.set('salary_min', String(search.salary_min));

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  return res.json();
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let searches: SavedSearch[] = [];
  try {
    searches = await getAllActiveSavedSearches();
  } catch (err) {
    console.error('Failed to load saved searches:', err);
    return NextResponse.json({ error: 'Failed to load searches' }, { status: 500 });
  }

  let totalSearched = 0;
  let totalNewListings = 0;

  for (const search of searches) {
    try {
      const adzunaData = await searchAdzuna(search);
      if (!adzunaData?.results) continue;

      const { data: profileData } = await adminSupabase
        .from('user_profile_data')
        .select('*')
        .eq('user_id', search.user_id)
        .maybeSingle();
      const profile = profileData as UserProfileData | null;
      const toInsert = [];

      for (const item of adzunaData.results) {
        const locationStr = item.location?.display_name ?? '';
        const remoteType = detectRemoteType(
          item.title,
          locationStr,
          item.description ?? ''
        );
        const matchScore = computeMatchScore(
          { title: item.title, description: item.description ?? '' },
          profile
        );

        if (matchScore < MIN_MATCH_SCORE) continue;

        toInsert.push({
          user_id: search.user_id,
          saved_search_id: search.id,
          external_id: item.id,
          source: 'adzuna',
          title: item.title,
          company: item.company?.display_name ?? 'Unknown',
          location: locationStr || null,
          description: item.description ?? null,
          url: item.redirect_url,
          salary_min: item.salary_min ?? null,
          salary_max: item.salary_max ?? null,
          remote_type: remoteType,
          posted_at: item.created ?? null,
          match_score: matchScore,
        });
      }

      await upsertJobListings(toInsert);
      await updateSavedSearchLastRun(search.id);

      totalSearched++;
      totalNewListings += toInsert.length;
    } catch (err) {
      console.error(`Job discovery failed for search ${search.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    searched: totalSearched,
    newListings: totalNewListings,
  });
}
