import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfileData } from '@/lib/types/database';

const anthropic = new Anthropic();

interface JobToScore {
  id: string;
  title: string;
  company: string;
  description: string | null;
  required_skills: string[] | null;
}

interface ScoredJob {
  id: string;
  score: number;
  reason: string;
}

/**
 * Build a compact profile string for the scoring prompt.
 * Keeps the prompt small — Haiku has a small context window per-token cost.
 */
function buildProfileContext(profile: UserProfileData): string {
  const parts: string[] = [];

  if (profile.summary) {
    parts.push(`Summary: ${profile.summary.slice(0, 300)}`);
  }

  const skills = (profile.skills ?? []).flatMap((cat) => cat.skills).slice(0, 30);
  if (skills.length > 0) {
    parts.push(`Skills: ${skills.join(', ')}`);
  }

  const titles = (profile.work_history ?? [])
    .slice(0, 4)
    .map((w) => `${w.title} at ${w.company}`)
    .filter(Boolean);
  if (titles.length > 0) {
    parts.push(`Recent experience: ${titles.join('; ')}`);
  }

  return parts.join('\n');
}

/**
 * Score a batch of jobs against a user profile using Claude Haiku.
 * Returns scored results; jobs Haiku can't score (e.g. no description) get score=0.
 */
async function scoreJobBatch(
  jobs: JobToScore[],
  profileContext: string
): Promise<ScoredJob[]> {
  const jobsPayload = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    description: (j.description ?? '').slice(0, 500),
    skills: j.required_skills?.slice(0, 10) ?? [],
  }));

  const prompt = `You are a job-fit scorer. Score each job against the candidate profile below.

CANDIDATE PROFILE:
${profileContext}

JOBS (JSON array):
${JSON.stringify(jobsPayload)}

For each job return a JSON array: [{"id": "...", "score": 0-100, "reason": "one sentence explaining the match or mismatch"}]

Rules:
- score 80-100: strong match (skills align well, title is familiar, role fits trajectory)
- score 50-79: partial match (some skills match, different seniority or adjacent role)
- score 20-49: weak match (related field but different specialization)
- score 0-19: poor match (different field, missing core skills)
- reason: max 15 words, specific (mention actual skills/experience from the profile)
- Return ONLY the JSON array, no other text`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON array from response (Haiku sometimes adds commentary)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as ScoredJob[];
    return parsed.filter(
      (r) => r.id && typeof r.score === 'number' && typeof r.reason === 'string'
    );
  } catch {
    return [];
  }
}

/**
 * Score all unscored job_listings for a user.
 * Called from cron, chat tools, and on-demand endpoint.
 * Uses admin or regular client depending on context.
 *
 * @returns number of jobs scored
 */
export async function scoreUnscoredJobsForUser(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  // 1. Fetch user profile
  const { data: profileData } = await supabase
    .from('user_profile_data')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const profile = profileData as UserProfileData | null;
  if (!profile) return 0;

  // Need at least some profile data to score against
  const hasProfile =
    (profile.skills?.length ?? 0) > 0 ||
    (profile.work_history?.length ?? 0) > 0 ||
    !!profile.summary;
  if (!hasProfile) return 0;

  const profileContext = buildProfileContext(profile);

  // 2. Fetch unscored listings (ai_scored_at IS NULL, limit 30 per call)
  const { data: listings } = await supabase
    .from('job_listings')
    .select('id, title, company, description, required_skills')
    .eq('user_id', userId)
    .is('ai_scored_at', null)
    .limit(30);

  if (!listings || listings.length === 0) return 0;

  // 3. Score in batches of 10
  const BATCH_SIZE = 10;
  const allScored: ScoredJob[] = [];

  for (let i = 0; i < listings.length; i += BATCH_SIZE) {
    const batch = listings.slice(i, i + BATCH_SIZE) as JobToScore[];
    const scored = await scoreJobBatch(batch, profileContext);
    allScored.push(...scored);
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < listings.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (allScored.length === 0) return 0;

  // 4. Update each listing with AI score + reason
  const now = new Date().toISOString();
  const updates = allScored.map((result) =>
    supabase
      .from('job_listings')
      .update({
        match_score: result.score,
        match_reason: result.reason,
        ai_scored_at: now,
      })
      .eq('id', result.id)
      .eq('user_id', userId) // RLS safety
  );

  await Promise.all(updates);
  return allScored.length;
}
