import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile } from '@/lib/data/profile';
import { getPrimaryMarket } from '@/lib/data/markets';
import { getMarketConfig } from '@/lib/markets';
import { computeMatchScore } from '@/lib/utils/match-score';
import { fetchJobTechDevRaw, hitToJobResult } from '@/lib/chat/jobtechdev-search';
import { computeFingerprint } from '@/lib/jobs/dedup';
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
  const remote = searchParams.get('remote') === 'true';
  const salaryMin = searchParams.get('salary_min');
  const page = parseInt(searchParams.get('page') || '1', 10);

  // Resolve market: explicit market param → explicit country param → user's primary market → default SE
  let country = searchParams.get('country') || '';
  let source = searchParams.get('source') || '';
  const marketParam = searchParams.get('market');

  if (marketParam) {
    const marketConfig = getMarketConfig(marketParam);
    if (marketConfig) {
      if (marketConfig.jobSources.primary === 'jobtechdev') {
        source = source || 'jobtechdev';
      } else {
        source = source || 'adzuna';
        country = country || marketConfig.jobSources.adzunaCountry || marketParam.toLowerCase();
      }
    }
  }

  if (!source || !country) {
    const primaryMarket = await getPrimaryMarket(supabase, user.id);
    const primaryCode = primaryMarket?.market_code ?? 'SE';
    const primaryConfig = getMarketConfig(primaryCode);
    if (primaryConfig) {
      if (!source) {
        source = primaryConfig.jobSources.primary === 'jobtechdev' ? 'jobtechdev' : 'adzuna';
      }
      if (!country) {
        country = primaryConfig.jobSources.adzunaCountry ?? primaryCode.toLowerCase();
      }
    }
  }

  source = source || 'jobtechdev';
  country = country || 'se';

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  // ─── JobTechDev path (default for Swedish jobs) ─────────────────────────
  if (source === 'jobtechdev') {
    const { hits, total } = await fetchJobTechDevRaw(q, {
      location: location || undefined,
      remote,
      limit: 20,
      offset: (page - 1) * 20,
    });

    if (hits.length === 0) {
      return NextResponse.json({ success: true, results: [], total: 0, page });
    }

    const profile = await getUserProfile(user.id);
    const results = hits.map((hit) => {
      const skillsText = (hit.must_have?.skills ?? []).map((s) => s.label).join(' ');
      const score = computeMatchScore(
        { title: hit.headline ?? '', description: `${hit.description?.text ?? ''} ${skillsText}` },
        profile
      );
      return hitToJobResult(hit, score);
    });

    results.sort((a, b) => b.matchScore - a.matchScore);

    // Batch check: mark results the user has already applied to
    const fingerprints = results.map((r) => computeFingerprint(r.company, r.title));
    const { data: appliedListings } = await supabase
      .from('job_listings')
      .select('dedup_fingerprint')
      .eq('user_id', user.id)
      .eq('has_applied', true)
      .in('dedup_fingerprint', fingerprints);
    const appliedFpSet = new Set((appliedListings ?? []).map((l) => l.dedup_fingerprint));
    for (const r of results) {
      if (appliedFpSet.has(computeFingerprint(r.company, r.title))) {
        (r as unknown as { alreadyApplied: boolean }).alreadyApplied = true;
      }
    }

    return NextResponse.json({ success: true, results, total, page });
  }

  // ─── Adzuna path (fallback for non-Swedish / international searches) ─────
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return NextResponse.json(
      { error: 'Adzuna API credentials not configured' },
      { status: 502 }
    );
  }

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

  results.sort((a, b) => b.match_score - a.match_score);

  // Batch check: mark results the user has already applied to
  const adzunaFingerprints = results.map((r) => computeFingerprint(r.company, r.title));
  const { data: adzunaApplied } = await supabase
    .from('job_listings')
    .select('dedup_fingerprint')
    .eq('user_id', user.id)
    .eq('has_applied', true)
    .in('dedup_fingerprint', adzunaFingerprints);
  const adzunaAppliedSet = new Set((adzunaApplied ?? []).map((l) => l.dedup_fingerprint));
  for (const r of results) {
    if (adzunaAppliedSet.has(computeFingerprint(r.company, r.title))) {
      r.alreadyApplied = true;
    }
  }

  return NextResponse.json({
    success: true,
    results,
    total: adzunaData.count ?? results.length,
    page,
  });
}
