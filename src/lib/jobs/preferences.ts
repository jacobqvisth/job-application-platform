import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LeadPreferences {
  id: string;
  positive_signals: string[];
  negative_signals: string[];
  preferred_companies: string[];
  preferred_locations: string[];
  min_score_threshold: number;
  decision_count: number;
  last_analyzed_at: string | null;
}

interface JobRow {
  title: string;
  company: string;
  location: string | null;
  remote_type: string | null;
}

interface AnalyzedPreferences {
  positive_signals: string[];
  negative_signals: string[];
  preferred_companies: string[];
  preferred_locations: string[];
  min_score_threshold: number;
}

export async function analyzeAndSavePreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<LeadPreferences> {
  const { data: approvedRows } = await supabase
    .from('job_listings')
    .select('title, company, location, remote_type')
    .eq('user_id', userId)
    .eq('lead_status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(100);

  const { data: rejectedRows } = await supabase
    .from('job_listings')
    .select('title, company, location, remote_type')
    .eq('user_id', userId)
    .eq('lead_status', 'rejected')
    .order('updated_at', { ascending: false })
    .limit(100);

  const approvedJobs: JobRow[] = approvedRows ?? [];
  const rejectedJobs: JobRow[] = rejectedRows ?? [];

  if (approvedJobs.length + rejectedJobs.length < 5) {
    throw new Error('Not enough decisions yet — need at least 5 approve/reject decisions');
  }

  const anthropic = new Anthropic();
  const prompt = `You are analyzing a job seeker's approve/reject decisions to extract their preferences.

APPROVED jobs (jobs they want to pursue):
${approvedJobs.map((j) => `- ${j.title} at ${j.company} (${j.location ?? 'no location'}, ${j.remote_type ?? 'no remote info'})`).join('\n')}

REJECTED jobs (jobs they didn't want):
${rejectedJobs.map((j) => `- ${j.title} at ${j.company} (${j.location ?? 'no location'}, ${j.remote_type ?? 'no remote info'})`).join('\n')}

Extract clear patterns from these decisions. Focus on:
- Title keywords that appear in approved but not rejected (e.g. "senior", "frontend", "fullstack")
- Title keywords that appear in rejected but not approved (e.g. "junior", "QA", "intern")
- Companies that appear multiple times in approved
- Locations/cities that appear in approved

Respond with ONLY valid JSON matching this exact shape:
{
  "positive_signals": ["signal1", "signal2"],
  "negative_signals": ["signal1", "signal2"],
  "preferred_companies": ["Company1", "Company2"],
  "preferred_locations": ["City1", "City2"],
  "min_score_threshold": 70
}

Rules:
- positive_signals and negative_signals: 3–10 lowercase keywords or short phrases
- preferred_companies and preferred_locations: only include if 2+ appear in approved, otherwise empty array
- min_score_threshold: 60–85, based on how selective the approved set looks
- Do not include signals that appear in both approved and rejected equally`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in analysis response');
  const parsed = JSON.parse(match[0]) as AnalyzedPreferences;

  const { data: saved, error } = await supabase
    .from('job_lead_preferences')
    .upsert(
      {
        user_id: userId,
        positive_signals: parsed.positive_signals ?? [],
        negative_signals: parsed.negative_signals ?? [],
        preferred_companies: parsed.preferred_companies ?? [],
        preferred_locations: parsed.preferred_locations ?? [],
        min_score_threshold: parsed.min_score_threshold ?? 70,
        decision_count: approvedJobs.length + rejectedJobs.length,
        last_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error || !saved) {
    throw new Error(error?.message ?? 'Failed to save preferences');
  }

  return saved as LeadPreferences;
}

export async function getPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<LeadPreferences | null> {
  const { data, error } = await supabase
    .from('job_lead_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return (data as LeadPreferences) ?? null;
}

export function scoreJobAgainstPreferences(
  job: { title: string; company: string; location: string | null; remote_type: string | null },
  prefs: LeadPreferences
): { score: number; reason: string } {
  let score = 0.5; // neutral start
  const matches: string[] = [];
  const titleLower = job.title.toLowerCase();
  const companyLower = job.company.toLowerCase();
  const locationLower = (job.location ?? '').toLowerCase();

  // +0.15 per positive signal found in title
  for (const signal of prefs.positive_signals) {
    if (titleLower.includes(signal.toLowerCase())) {
      score += 0.15;
      matches.push(signal);
    }
  }

  // -0.2 per negative signal found in title (stronger penalty)
  for (const signal of prefs.negative_signals) {
    if (titleLower.includes(signal.toLowerCase())) {
      score -= 0.2;
    }
  }

  // +0.1 if company matches a preferred company
  if (prefs.preferred_companies.some((c) => companyLower.includes(c.toLowerCase()))) {
    score += 0.1;
    matches.push(job.company);
  }

  // +0.1 if location matches a preferred location
  if (
    job.location &&
    prefs.preferred_locations.some((l) => locationLower.includes(l.toLowerCase()))
  ) {
    score += 0.1;
    matches.push(job.location);
  }

  // Clamp to [0, 1]
  score = Math.max(0, Math.min(1, score));

  const reason =
    matches.length > 0
      ? `Matches: ${matches.slice(0, 4).join(', ')}`
      : 'No strong preference signals found';

  return { score, reason };
}
