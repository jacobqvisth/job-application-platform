import type { JobResult } from './types';

const JOBTECHDEV_BASE_URL = 'https://jobsearch.api.jobtechdev.se';

// ATS detection from apply URL
function detectAts(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/teamtailor\.com/.test(url)) return 'teamtailor';
  if (/varbi\.com/.test(url)) return 'varbi';
  if (/jobylon\.com/.test(url)) return 'jobylon';
  if (/reachmee\.com/.test(url)) return 'reachmee';
  if (/myworkday\.com|workday\.com/.test(url)) return 'workday';
  if (/greenhouse\.io/.test(url)) return 'greenhouse';
  if (/lever\.co/.test(url)) return 'lever';
  return null;
}

// JobTechDev raw hit shape
export interface JtdHit {
  id: string;
  headline: string;
  description?: { text?: string };
  employer?: { name?: string; organization_number?: string };
  workplace_address?: { municipality?: string; region?: string; city?: string };
  employment_type?: { label?: string };
  occupation?: { label?: string };
  occupation_field?: { label?: string };
  must_have?: { skills?: { label: string; weight?: number }[] };
  nice_to_have?: { skills?: { label: string }[] };
  application_details?: { url?: string | null };
  webpage_url?: string;
  publication_date?: string;
  application_deadline?: string;
  number_of_vacancies?: number;
  salary_description?: string;
}

interface JtdResponse {
  total?: { value?: number };
  hits?: JtdHit[];
}

export interface JtdSearchOpts {
  location?: string;
  remote?: boolean;
  limit?: number;
  offset?: number;
  publishedAfter?: string;
  sort?: 'relevance' | 'pubdate-desc';
}

function buildSearchUrl(query: string, opts?: JtdSearchOpts): URL {
  const url = new URL(`${JOBTECHDEV_BASE_URL}/search`);
  const qParts = [query];
  if (opts?.location) qParts.push(opts.location);
  url.searchParams.set('q', qParts.join(' '));
  url.searchParams.set('limit', String(opts?.limit ?? 20));
  if (opts?.offset) url.searchParams.set('offset', String(opts.offset));
  if (opts?.sort) url.searchParams.set('sort', opts.sort);
  if (opts?.remote) url.searchParams.set('remote', 'true');
  if (opts?.publishedAfter) url.searchParams.set('published-after', opts.publishedAfter);
  url.searchParams.set('resdet', 'full');
  return url;
}

// Map a raw JtdHit to the shared JobResult type
export function hitToJobResult(hit: JtdHit, matchScore: number): JobResult {
  const applyUrl = hit.application_details?.url ?? null;
  const url = applyUrl ?? hit.webpage_url ?? '';
  const ats = detectAts(applyUrl) ?? detectAts(hit.webpage_url) ?? null;

  const location =
    hit.workplace_address?.city ??
    hit.workplace_address?.municipality ??
    hit.workplace_address?.region ??
    null;

  const description = hit.description?.text ?? '';
  const combined = `${hit.headline ?? ''} ${description}`.toLowerCase();
  const remoteType: 'remote' | 'hybrid' | 'unknown' = combined.includes('remote')
    ? 'remote'
    : combined.includes('hybrid')
      ? 'hybrid'
      : 'unknown';

  return {
    id: hit.id,
    title: hit.headline ?? '',
    company: hit.employer?.name ?? 'Unknown',
    location,
    remoteType,
    salary: hit.salary_description ?? null,
    matchScore,
    description,
    url,
    source: 'jobtechdev',
    postedAt: hit.publication_date ?? null,
    ats,
    applyUrl,
    occupation: hit.occupation?.label ?? null,
    occupationField: hit.occupation_field?.label ?? null,
    employmentType: hit.employment_type?.label ?? null,
    deadline: hit.application_deadline ?? null,
    requiredSkills: (hit.must_have?.skills ?? []).map((s) => s.label),
    niceToHaveSkills: (hit.nice_to_have?.skills ?? []).map((s) => s.label),
    numberOfVacancies: hit.number_of_vacancies ?? null,
    employerOrgNumber: hit.employer?.organization_number ?? null,
  };
}

// Fetch raw hits without match scoring — used by cron and other server contexts
export async function fetchJobTechDevRaw(
  query: string,
  opts?: JtdSearchOpts
): Promise<{ hits: JtdHit[]; total: number }> {
  const url = buildSearchUrl(query, opts);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return { hits: [], total: 0 };
    const data = (await res.json()) as JtdResponse;
    return { hits: data.hits ?? [], total: data.total?.value ?? 0 };
  } catch {
    return { hits: [], total: 0 };
  }
}

// Full search with user profile match scoring — used by chat tool
export async function searchJobTechDev(
  userId: string,
  query: string,
  opts?: JtdSearchOpts
): Promise<{ jobs: JobResult[]; total: number }> {
  const { hits, total } = await fetchJobTechDevRaw(query, opts);
  if (hits.length === 0) return { jobs: [], total: 0 };

  const { getUserProfile } = await import('@/lib/data/profile');
  const { computeMatchScore } = await import('@/lib/utils/match-score');
  const profile = await getUserProfile(userId);

  const jobs = hits.map((hit) => {
    // Enrich description with required skills for better match scoring
    const skillsText = (hit.must_have?.skills ?? []).map((s) => s.label).join(' ');
    const score = computeMatchScore(
      { title: hit.headline ?? '', description: `${hit.description?.text ?? ''} ${skillsText}` },
      profile
    );
    return hitToJobResult(hit, score);
  });

  return { jobs: jobs.sort((a, b) => b.matchScore - a.matchScore), total };
}

// Fetch single ad by ID
export async function getJobTechDevAd(id: string): Promise<JobResult | null> {
  try {
    const res = await fetch(`${JOBTECHDEV_BASE_URL}/ad/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const hit = (await res.json()) as JtdHit;
    return hitToJobResult(hit, 0);
  } catch {
    return null;
  }
}

// Typeahead autocomplete for search UI
export async function autocompleteJobTechDev(
  query: string,
  limit = 10
): Promise<{ value: string; type: string; occurrences: number }[]> {
  try {
    const url = new URL(`${JOBTECHDEV_BASE_URL}/complete`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('contextual', 'true');
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      typeahead?: { value: string; type: string; occurrences: number }[];
    };
    return data.typeahead ?? [];
  } catch {
    return [];
  }
}
