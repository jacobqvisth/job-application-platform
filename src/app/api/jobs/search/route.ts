import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/data/profile';
import { computeMatchScore } from '@/lib/utils/match-score';
import type { AdzunaJobResult } from '@/lib/types/database';

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

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const location = searchParams.get('location') || '';
  const country = searchParams.get('country') || 'gb';
  const remote = searchParams.get('remote') === 'true';
  const salaryMin = searchParams.get('salary_min');
  const page = parseInt(searchParams.get('page') || '1', 10);

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: 'Adzuna API credentials not configured' },
      { status: 502 }
    );
  }

  // Build Adzuna query
  const whatQuery = remote ? `remote ${q}` : q;
  const whereQuery = remote && !location ? 'remote' : location;

  const adzunaUrl = new URL(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`
  );
  adzunaUrl.searchParams.set('app_id', appId);
  adzunaUrl.searchParams.set('app_key', appKey);
  adzunaUrl.searchParams.set('what', whatQuery);
  adzunaUrl.searchParams.set('results_per_page', '20');
  adzunaUrl.searchParams.set('full_time', '1');
  if (whereQuery) adzunaUrl.searchParams.set('where', whereQuery);
  if (salaryMin) adzunaUrl.searchParams.set('salary_min', salaryMin);

  let adzunaData: {
    results: Array<{
      id: string;
      title: string;
      company: { display_name: string };
      location: { display_name: string };
      description: string;
      redirect_url: string;
      salary_min?: number;
      salary_max?: number;
      created: string;
    }>;
    count: number;
  };

  try {
    const adzunaRes = await fetch(adzunaUrl.toString());
    if (!adzunaRes.ok) {
      const text = await adzunaRes.text();
      console.error('Adzuna API error:', adzunaRes.status, text);
      return NextResponse.json(
        { error: 'Job search API unavailable. Please try again later.' },
        { status: 502 }
      );
    }
    adzunaData = await adzunaRes.json();
  } catch (err) {
    console.error('Adzuna fetch failed:', err);
    return NextResponse.json(
      { error: 'Failed to reach job search API.' },
      { status: 502 }
    );
  }

  const profile = await getUserProfile(user.id);

  const results: AdzunaJobResult[] = (adzunaData.results ?? []).map((item) => {
    const locationStr = item.location?.display_name ?? '';
    const remoteType = detectRemoteType(item.title, locationStr, item.description ?? '');
    const matchScore = computeMatchScore(
      { title: item.title, description: item.description ?? '' },
      profile
    );
    return {
      external_id: item.id,
      title: item.title,
      company: item.company?.display_name ?? 'Unknown',
      location: locationStr || null,
      description: item.description ?? '',
      url: item.redirect_url,
      salary_min: item.salary_min ?? null,
      salary_max: item.salary_max ?? null,
      remote_type: remoteType,
      posted_at: item.created ?? null,
      match_score: matchScore,
    };
  });

  // Sort by match score descending
  results.sort((a, b) => b.match_score - a.match_score);

  return NextResponse.json({
    success: true,
    results,
    total: adzunaData.count ?? results.length,
    page,
  });
}
