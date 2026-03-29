import { createClient } from '@/lib/supabase/server';
import type { JobResult } from './types';

export async function searchAdzunaLive(
  userId: string,
  query: string,
  opts: { location?: string; country?: string; remote?: boolean; salaryMin?: number }
): Promise<JobResult[] | null> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return null;

  const country = opts.country ?? 'se';
  const whatQuery = opts.remote ? `remote ${query}` : query;
  const whereQuery = opts.remote && !opts.location ? 'remote' : (opts.location ?? '');

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/1`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('what', whatQuery);
  url.searchParams.set('results_per_page', '20');
  url.searchParams.set('full_time', '1');
  if (whereQuery) url.searchParams.set('where', whereQuery);
  if (opts.salaryMin) url.searchParams.set('salary_min', String(opts.salaryMin));

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json() as { results?: Record<string, unknown>[] };
    if (!data?.results?.length) return null;

    // Get user profile for match scoring
    const supabase = await createClient();
    void supabase; // createClient establishes auth context
    const { getUserProfile } = await import('@/lib/data/profile');
    const profile = await getUserProfile(userId);
    const { computeMatchScore } = await import('@/lib/utils/match-score');

    const jobs: JobResult[] = data.results.map((item) => {
      const locationStr = (item.location as { display_name?: string } | undefined)?.display_name ?? '';
      const title = (item.title as string | undefined) ?? '';
      const company = (item.company as { display_name?: string } | undefined)?.display_name ?? 'Unknown';
      const description = (item.description as string | undefined) ?? '';
      const text = `${title} ${locationStr} ${description}`.toLowerCase();

      const remoteType: 'remote' | 'hybrid' | 'unknown' = text.includes('remote')
        ? 'remote'
        : text.includes('hybrid')
          ? 'hybrid'
          : 'unknown';

      const matchScore = computeMatchScore({ title, description }, profile);

      const salaryMin = item.salary_min as number | undefined;
      const salaryMax = item.salary_max as number | undefined;

      return {
        id: String(item.id),
        title,
        company,
        location: locationStr || null,
        remoteType,
        salary:
          salaryMin && salaryMax
            ? `${Math.round(salaryMin / 1000)}k–${Math.round(salaryMax / 1000)}k`
            : salaryMin
              ? `${Math.round(salaryMin / 1000)}k+`
              : null,
        matchScore,
        description,
        url: (item.redirect_url as string | undefined) ?? '',
        source: 'adzuna',
        postedAt: (item.created as string | undefined) ?? null,
      };
    });

    return jobs.sort((a, b) => b.matchScore - a.matchScore);
  } catch {
    return null;
  }
}
