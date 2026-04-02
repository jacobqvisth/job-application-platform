import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS, estimateCost } from '@/lib/config/models';
import { getPackage, updatePackage } from '@/lib/data/application-studio';
import type {
  EvidenceMapping,
  ApplicationStrategy,
  AiUsageStep,
  JobRequirement,
} from '@/lib/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { package_id } = await req.json();
  if (!package_id) return NextResponse.json({ error: 'package_id required' }, { status: 400 });

  const pkg = await getPackage(supabase, package_id, user.id);
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  if (pkg.status !== 'matching') {
    return NextResponse.json({ error: `Package is in ${pkg.status} state, expected matching` }, { status: 400 });
  }

  // ─── 1. Merge checkpoint 1 edits into requirements ───────────────────────
  const analysis = pkg.job_analysis!;
  let requirements: JobRequirement[] = analysis.requirements;
  const edits = pkg.checkpoint_1_edits;
  if (edits?.edited_requirements) {
    requirements = edits.edited_requirements;
  } else if (edits?.priority_overrides) {
    requirements = requirements.map((r, i) => ({
      ...r,
      priority: edits.priority_overrides?.[i] ?? r.priority,
    }));
  }

  // ─── 2. Gather ALL user context ──────────────────────────────────────────

  const { data: profileData } = await supabase
    .from('user_profile_data')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: knowledgeItems } = await supabase
    .from('knowledge_items')
    .select('id, category, title, content, confidence, tags')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(60);

  const categoryPriority: Record<string, number> = {
    achievement: 0, story: 1, skill: 2, fact: 3,
    value: 4, philosophy: 5, preference: 6, self_assessment: 7,
  };
  const sortedKnowledge = (knowledgeItems || [])
    .sort((a, b) => {
      const confA = a.confidence === 'user_confirmed' ? 0 : 1;
      const confB = b.confidence === 'user_confirmed' ? 0 : 1;
      if (confA !== confB) return confA - confB;
      return (categoryPriority[a.category] ?? 9) - (categoryPriority[b.category] ?? 9);
    })
    .slice(0, 50);

  const { data: answers } = await supabase
    .from('canonical_questions')
    .select('id, canonical_text, category, screening_answers(id, answer, rating, tone)')
    .eq('user_id', user.id);

  const ratingOrder: Record<string, number> = { strong: 0, good: 1, needs_work: 2, untested: 3 };
  const bestAnswers = (answers || []).map((q) => {
    const sorted = ((q.screening_answers as { rating: string; answer: string }[]) || []).sort(
      (a, b) => (ratingOrder[a.rating] ?? 9) - (ratingOrder[b.rating] ?? 9)
    );
    const best = sorted[0];
    return best
      ? { question_id: q.id, question: q.canonical_text, category: q.category, answer: best.answer, rating: best.rating }
      : null;
  }).filter(Boolean).slice(0, 20) as { question_id: string; question: string; category: string; answer: string; rating: string }[];

  const { data: profileSummary } = await supabase
    .from('knowledge_profile_summary')
    .select('*')
    .eq('user_id', user.id)
    .single();

  const { data: marketSettings } = await supabase
    .from('user_market_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  // ─── 3. Build context strings ────────────────────────────────────────────

  const workHistoryContext = profileData?.work_history?.length
    ? (profileData.work_history as {
        title: string; company: string; startDate: string; endDate: string;
        current: boolean; description: string; achievements: string[];
      }[]).map((w, i) =>
        `[${i}] ${w.title} at ${w.company} (${w.startDate}–${w.endDate || 'present'})${w.current ? ' [CURRENT]' : ''}\n` +
        `    Description: ${w.description || 'N/A'}\n` +
        `    Achievements: ${w.achievements?.length ? w.achievements.join('; ') : 'None listed'}`
      ).join('\n\n')
    : 'No work history available.';

  const educationContext = profileData?.education?.length
    ? (profileData.education as { degree: string; school: string; year: string }[]).map((e) =>
        `${e.degree} — ${e.school} (${e.year})`
      ).join('\n')
    : 'No education data.';

  const skillsContext = profileData?.skills?.length
    ? (profileData.skills as { category: string; skills: string[] }[]).map((c) =>
        `${c.category}: ${c.skills.join(', ')}`
      ).join('\n')
    : 'No skills data.';

  const knowledgeContext = sortedKnowledge.length
    ? sortedKnowledge.map((k) =>
        `[${k.category}] "${k.title}" — ${k.content.slice(0, 300)}${k.content.length > 300 ? '…' : ''}`
      ).join('\n')
    : 'No knowledge items.';

  const answersContext = bestAnswers.length
    ? bestAnswers.map((a) =>
        `[${a.category}] Q: "${a.question}"\n  A (${a.rating}): "${a.answer.slice(0, 200)}${a.answer.length > 200 ? '…' : ''}"`
      ).join('\n\n')
    : 'No answer library entries.';

  const profileSummaryContext = profileSummary
    ? `Executive summary: ${(profileSummary as { executive_summary?: string }).executive_summary || 'N/A'}
Key strengths: ${(profileSummary as { key_strengths?: string[] }).key_strengths?.join(', ') || 'N/A'}
Career narrative: ${(profileSummary as { career_narrative?: string }).career_narrative || 'N/A'}
Leadership style: ${(profileSummary as { leadership_style?: string }).leadership_style || 'N/A'}
Unique value proposition: ${(profileSummary as { unique_value_proposition?: string }).unique_value_proposition || 'N/A'}
Ideal role: ${(profileSummary as { ideal_role_description?: string }).ideal_role_description || 'N/A'}`
    : 'No profile summary available.';

  const requirementsText = requirements
    .map((r, i) => `[${i}] (${r.category}, priority ${r.priority}/5) ${r.text}`)
    .join('\n');

  const detectedLanguage = analysis.detected_language || 'en';
  const marketCode = (marketSettings as { market_code?: string } | null)?.market_code || 'SE';

  // ─── 4. Single Sonnet call for evidence mapping + strategy ───────────────

  const aiSteps: AiUsageStep[] = [...(pkg.ai_usage?.steps || [])];
  const start = Date.now();

  const resp = await anthropic.messages.create({
    model: MODELS.standard,
    max_tokens: 6000,
    messages: [{
      role: 'user',
      content: `You are a senior career strategist helping a job seeker build the strongest possible application. Your task has two parts:

## PART A: Evidence Matching
For each job requirement below, find the BEST evidence from the candidate's background. Look across work history, knowledge items, answer library, and profile summary. For each requirement, provide 1-4 evidence items ranked by relevance.

## PART B: Application Strategy
Based on the evidence mapping, recommend a positioning strategy for this specific application.

---

## Job Details
Company: ${pkg.company_research?.company_name || 'Unknown company'}
Industry: ${pkg.company_research?.industry || 'Unknown'}
Company size: ${pkg.company_research?.company_size || 'Unknown'}
Culture: ${pkg.company_research?.culture_notes || 'No culture data'}
Role family: ${analysis.role_family}
Role level: ${analysis.role_level}
Detected language: ${detectedLanguage}
Market: ${marketCode}

## Requirements to Match
${requirementsText}

## Candidate: Work History
${workHistoryContext}

## Candidate: Education
${educationContext}

## Candidate: Skills
${skillsContext}

## Candidate: Profile Summary
${profileSummaryContext}

## Candidate: Knowledge Items (stories, achievements, skills, values)
${knowledgeContext}

## Candidate: Answer Library (best-rated answers to screening questions)
${answersContext}

---

## Instructions

Return a JSON object with exactly this structure:
{
  "evidence_mapping": {
    "matches": [
      {
        "requirement": "the requirement text",
        "category": "must_have | nice_to_have | inferred",
        "priority": 1-5,
        "evidence": [
          {
            "source": "work_history | knowledge_item | answer_library | profile",
            "source_id": "the [index] or [id] from the context above, or null",
            "text": "specific evidence text — quote achievements, metrics, or stories. Be specific, not generic.",
            "relevance_score": 0-100,
            "selected": true
          }
        ],
        "gap_analysis": "if no evidence scores above 50, explain the gap and suggest how to address it. Otherwise null."
      }
    ],
    "overall_match_score": 0-100,
    "strongest_areas": ["area1", "area2", "area3"],
    "gap_areas": ["gap1", "gap2"]
  },
  "strategy": {
    "positioning": "1-2 sentence positioning statement for this specific role",
    "lead_with": ["strength1", "strength2", "strength3"],
    "gap_framing": [
      { "gap": "the gap", "framing_strategy": "how to frame this positively" }
    ],
    "tone": "formal | warm | energetic | executive",
    "template_recommendation": "clean | modern | compact | swedish",
    "narrative_arc": "2-3 sentences describing the story the application should tell",
    "differentiators": ["what makes this candidate unique for this role"]
  }
}

## Rules for Evidence Matching:
1. Every evidence "text" MUST be grounded in specific facts from the context — never fabricate
2. Work history evidence should reference specific achievements with metrics when available
3. Knowledge items provide stories, values, and self-assessed strengths — use them for behavioral and culture fit
4. Answer library entries show how the candidate naturally responds — use phrasing and themes from them
5. Set "selected": true for the top 1-2 evidence items per requirement, false for supplementary ones
6. Requirements with no evidence above score 40 MUST have a gap_analysis
7. For "source_id": use the [index] from work history (e.g. "0", "1"), the category tag from knowledge items, or the question_id from answer library

## Rules for Strategy:
1. "positioning" should be specific to THIS company and role, not generic
2. "lead_with" should be the 3 strongest evidence-backed claims
3. "gap_framing" should be honest but positive — never lie, but show adjacent experience or learning attitude
4. "tone" should match the company culture signals: startup → "energetic", enterprise → "formal", small company → "warm", executive role → "executive"
5. "template_recommendation" should be "swedish" if detected_language is "sv", otherwise pick based on role level and industry
6. "narrative_arc" should be a coherent story connecting past experience to this specific role
7. "differentiators" should be 2-4 things that genuinely set this candidate apart (not generic claims)

Return ONLY the JSON object, no markdown code blocks, no explanation.`,
    }],
  });

  const duration = Date.now() - start;
  const text = resp.content[0].type === 'text' ? resp.content[0].text : '';

  aiSteps.push({
    step: 'evidence_matching_and_strategy',
    model: MODELS.standard,
    input_tokens: resp.usage.input_tokens,
    output_tokens: resp.usage.output_tokens,
    duration_ms: duration,
    cost_estimate: estimateCost('standard', resp.usage.input_tokens, resp.usage.output_tokens),
  });

  const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as {
    evidence_mapping: EvidenceMapping;
    strategy: ApplicationStrategy;
  };
  const evidenceMapping: EvidenceMapping = parsed.evidence_mapping;
  const strategy: ApplicationStrategy = parsed.strategy;

  // ─── 5. Update package ───────────────────────────────────────────────────

  const totalCost = aiSteps.reduce((sum, s) => sum + s.cost_estimate, 0);
  const updated = await updatePackage(supabase, package_id, user.id, {
    status: 'checkpoint_2',
    evidence_mapping: evidenceMapping,
    strategy: strategy,
    ai_usage: { steps: aiSteps, total_cost_estimate: totalCost },
  });

  return NextResponse.json({
    package_id: updated.id,
    evidence_mapping: evidenceMapping,
    strategy: strategy,
    ai_usage: { steps: aiSteps, total_cost_estimate: totalCost },
  });
}
