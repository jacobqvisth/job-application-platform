import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getAllActiveSavedSearches, updateSavedSearchLastRun } from '@/lib/data/saved-searches';
import { upsertJobListings } from '@/lib/data/job-listings';
import { computeMatchScore } from '@/lib/utils/match-score';
import { fetchJobTechDevRaw, hitToJobResult } from '@/lib/chat/jobtechdev-search';
import { getMarketConfig } from '@/lib/markets';
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

  const country = getAdzunaCountry(search);
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

function isSwedishSearch(search: SavedSearch): boolean {
  const country = search.country?.toLowerCase();
  if (!country || country === 'se') return true;
  // Also check via market config — if country maps to a jobtechdev market, use that path
  const config = getMarketConfig(country.toUpperCase());
  return config?.jobSources.primary === 'jobtechdev';
}

function getAdzunaCountry(search: SavedSearch): string {
  const country = search.country?.toLowerCase() ?? 'se';
  const config = getMarketConfig(country.toUpperCase());
  return config?.jobSources.adzunaCountry ?? country;
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
      // Fetch user profile for match scoring (admin context)
      const { data: profileData } = await adminSupabase
        .from('user_profile_data')
        .select('*')
        .eq('user_id', search.user_id)
        .maybeSingle();
      const profile = profileData as UserProfileData | null;

      const toInsert = [];

      if (isSwedishSearch(search)) {
        // ─── JobTechDev path for Swedish searches ────────────────────────────
        // Use published-after based on last run (or 1440 minutes = 24h if first run)
        const publishedAfter = search.last_run_at
          ? new Date(search.last_run_at).toISOString()
          : '1440';

        const { hits } = await fetchJobTechDevRaw(search.query, {
          location: search.location ?? undefined,
          remote: search.remote_only,
          limit: 20,
          publishedAfter,
        });

        for (const hit of hits) {
          const title = hit.headline ?? '';
          const description = hit.description?.text ?? '';
          const skillsText = (hit.must_have?.skills ?? []).map((s) => s.label).join(' ');
          const location =
            hit.workplace_address?.city ??
            hit.workplace_address?.municipality ??
            hit.workplace_address?.region ??
            null;

          const matchScore = computeMatchScore(
            { title, description: `${description} ${skillsText}` },
            profile
          );

          if (matchScore < MIN_MATCH_SCORE) continue;

          const result = hitToJobResult(hit, matchScore);

          toInsert.push({
            user_id: search.user_id,
            saved_search_id: search.id,
            external_id: hit.id,
            source: 'jobtechdev' as const,
            title: result.title,
            company: result.company,
            location,
            description: description || null,
            url: result.url,
            salary_min: null,
            salary_max: null,
            remote_type: result.remoteType ?? null,
            posted_at: hit.publication_date ?? null,
            match_score: matchScore,
            // New JobTechDev-specific fields
            ats_type: result.ats ?? null,
            apply_url: result.applyUrl ?? null,
            occupation: result.occupation ?? null,
            occupation_field: result.occupationField ?? null,
            employment_type: result.employmentType ?? null,
            deadline: result.deadline ?? null,
            required_skills: result.requiredSkills?.length ? result.requiredSkills : null,
            number_of_vacancies: result.numberOfVacancies ?? null,
          });
        }
      } else {
        // ─── Adzuna path for non-Swedish searches ───────────────────────────
        const adzunaData = await searchAdzuna(search);
        if (!adzunaData?.results) {
          // Add delay before next search
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }

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
            source: 'adzuna' as const,
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
            ats_type: null,
            apply_url: null,
            occupation: null,
            occupation_field: null,
            employment_type: null,
            deadline: null,
            required_skills: null,
            number_of_vacancies: null,
          });
        }
      }

      await upsertJobListings(toInsert);
      await updateSavedSearchLastRun(search.id);

      totalSearched++;
      totalNewListings += toInsert.length;
    } catch (err) {
      console.error(`Job discovery failed for search ${search.id}:`, err);
    }

    // Polite delay between requests
    await new Promise((r) => setTimeout(r, 100));
  }

  return NextResponse.json({
    success: true,
    searched: totalSearched,
    newListings: totalNewListings,
  });
}
