import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPackage, updatePackage } from '@/lib/data/application-studio';
import { MODELS, estimateCost } from '@/lib/config/models';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AiUsage,
  ResumeContent,
  GeneratedCoverLetter,
  ScreeningQuestion,
  EvidenceItem,
  RequirementMatch,
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
  if (pkg.status !== 'generating') {
    return NextResponse.json(
      { error: `Package is in ${pkg.status} state, expected generating` },
      { status: 400 }
    );
  }

  const analysis = pkg.job_analysis;
  const research = pkg.company_research;
  const evidenceMapping = pkg.evidence_mapping;
  const strategy = pkg.strategy;

  if (!analysis || !research || !evidenceMapping || !strategy) {
    return NextResponse.json(
      { error: 'Package is missing required data. Please restart from step 2.' },
      { status: 400 }
    );
  }

  // Load profile and base resume
  const [profileResult, baseResumeResult, summaryResult] = await Promise.all([
    supabase.from('user_profile_data').select('*').eq('user_id', user.id).single(),
    supabase
      .from('resumes')
      .select('content')
      .eq('user_id', user.id)
      .eq('is_base', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    supabase.from('knowledge_profile_summary').select('summary_text, executive_summary').eq('user_id', user.id).single(),
  ]);

  const profile = profileResult.data;
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found. Please fill in your profile first.' }, { status: 400 });
  }

  const baseResume = baseResumeResult.data?.content as ResumeContent | null;
  const profileSummary = (summaryResult.data as { summary_text?: string; executive_summary?: string } | null)?.summary_text
    ?? (summaryResult.data as { summary_text?: string; executive_summary?: string } | null)?.executive_summary
    ?? null;

  const isSwedish = analysis.detected_language === 'sv';

  // Build selected evidence summary
  const selectedEvidence = evidenceMapping.matches
    .map((match: RequirementMatch) => {
      const selected = match.evidence.filter((e: EvidenceItem) => e.selected);
      if (selected.length === 0 && !match.gap_analysis) return null;
      return {
        requirement: match.requirement,
        category: match.category,
        selected_evidence: selected.map((e: EvidenceItem) => e.text),
        gap_analysis: match.gap_analysis,
      };
    })
    .filter(Boolean);

  const workHistoryJson = JSON.stringify(
    (profile.work_history ?? []).map((job: { id: string; title: string; company: string; location: string; startDate: string; endDate: string | null; bullets: string[] }) => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      startDate: job.startDate,
      endDate: job.endDate,
      bullets: job.bullets,
    })),
    null,
    2
  );

  const educationJson = JSON.stringify(
    (profile.education ?? []).map((edu: { id: string; institution: string; degree: string; field: string; startDate: string; endDate: string | null; gpa?: string }) => ({
      id: edu.id,
      institution: edu.institution,
      degree: edu.degree,
      field: edu.field,
      startDate: edu.startDate,
      endDate: edu.endDate,
      gpa: edu.gpa,
    })),
    null,
    2
  );

  const skillsJson = JSON.stringify(
    (profile.skills ?? []).map((cat: { id: string; name: string; skills: string[] }) => ({
      id: cat.id,
      name: cat.name,
      skills: cat.skills,
    })),
    null,
    2
  );

  const baseResumeJson = baseResume
    ? JSON.stringify(baseResume, null, 2).slice(0, 3000)
    : 'null';

  const gapFramingText = strategy.gap_framing.length > 0
    ? strategy.gap_framing.map((gf) => `- "${gf.gap}": ${gf.framing_strategy}`).join('\n')
    : 'None';

  const coverLetterInstruction = isSwedish
    ? `Write a "Personligt brev" (Swedish personal letter) in Swedish:
- Personal and reflective, not just a CV summary
- Warm but professional tone: ${strategy.tone}
- Address: Vem är jag? Varför detta företag? Varför denna roll? Vad kan jag bidra med?
- ~300-400 words, 3-4 paragraphs
- Do NOT start with "Jag söker tjänsten som..." — start with genuine motivation
- End with looking forward to an interview
- Avoid excessive superlatives — Swedish culture values teamwork and humility`
    : `Write a cover letter in ${strategy.tone} tone:
- Professional and compelling, directly addressing the role
- Open with: ${strategy.positioning}
- Highlight: ${strategy.differentiators.join(', ')}
- Address gaps: use gap_framing strategies
- ~300-400 words, 3-4 paragraphs`;

  const start = Date.now();

  const response = await anthropic.messages.create({
    model: MODELS.premium,
    max_tokens: 6000,
    messages: [
      {
        role: 'user',
        content: `You are a world-class career strategist and resume writer. Generate a complete, tailored application package.

## Target Role
${analysis.role_level} ${analysis.role_family.replace(/_/g, ' ')} at ${research.company_name}
Industry: ${research.industry} | Size: ${research.company_size}
Culture: ${research.culture_notes}
Language: ${analysis.detected_language}

## Application Strategy
Positioning: ${strategy.positioning}
Lead with: ${strategy.lead_with.join(', ')}
Tone: ${strategy.tone}
Template: ${strategy.template_recommendation}
Narrative arc: ${strategy.narrative_arc}
Differentiators: ${strategy.differentiators.join(', ')}

Gap framings:
${gapFramingText}

## Selected Evidence (use ONLY this — never fabricate)
${JSON.stringify(selectedEvidence, null, 2)}

## Candidate's Work History (for resume rewrite)
${workHistoryJson}

## Candidate's Education
${educationJson}

## Candidate's Skills
${skillsJson}

## Profile Summary
${profileSummary ?? profile.summary ?? 'Not provided'}

## Base Resume Structure (preserve IDs)
${baseResumeJson}

## Instructions

### 1. TAILORED RESUME
Generate a complete ResumeContent JSON object:
- KEEP the same IDs as the base resume for existing items
- Rewrite experience bullets to emphasize matched requirements
- Rewrite summary to match the positioning statement
- Reorder skills categories: most relevant first
- Do NOT add experience that doesn't exist in work history
- Template: "${strategy.template_recommendation}"
- Language: ${isSwedish ? 'Swedish' : 'English'}

ResumeContent structure:
{
  "template": "${strategy.template_recommendation}",
  "sections": [
    { "id": "summary", "type": "summary", "title": "${isSwedish ? 'Profil' : 'Professional Summary'}", "visible": true, "order": 0, "content": { "text": "..." } },
    { "id": "experience", "type": "experience", "title": "${isSwedish ? 'Arbetslivserfarenhet' : 'Experience'}", "visible": true, "order": 1, "content": { "items": [{ "id": "...", "company": "...", "title": "...", "location": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "bullets": ["..."] }] } },
    { "id": "education", "type": "education", "title": "${isSwedish ? 'Utbildning' : 'Education'}", "visible": true, "order": 2, "content": { "items": [{ "id": "...", "institution": "...", "degree": "...", "field": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null" }] } },
    { "id": "skills", "type": "skills", "title": "${isSwedish ? 'Kompetenser' : 'Skills'}", "visible": true, "order": 3, "content": { "categories": [{ "id": "...", "name": "...", "skills": ["..."] }] } }
  ]
}

### 2. COVER LETTER
${coverLetterInstruction}

### 3. SCREENING QUESTIONS
Generate 5-7 likely screening questions for a ${analysis.role_level} ${analysis.role_family.replace(/_/g, ' ')} role.
- Answers grounded in real evidence only — never fabricate
- Categories: "behavioral", "technical", "motivational", "situational"
- ${isSwedish ? 'Swedish language' : 'English language'}

## Output Format
Return ONLY this JSON (no markdown, no code fences):
{
  "resume": { ...ResumeContent... },
  "cover_letter": "Full text with \\n for line breaks",
  "screening_questions": [
    {
      "question": "...",
      "answer": "...",
      "evidence_sources": ["brief reference"],
      "category": "behavioral"
    }
  ]
}`,
      },
    ],
  });

  const duration = Date.now() - start;
  const content = response.content[0];
  if (content.type !== 'text') {
    return NextResponse.json({ error: 'Unexpected response from AI' }, { status: 500 });
  }

  let parsed: {
    resume: ResumeContent;
    cover_letter: string;
    screening_questions: ScreeningQuestion[];
  };
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found');
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
  }

  if (!parsed.resume?.sections || !Array.isArray(parsed.resume.sections)) {
    return NextResponse.json({ error: 'AI returned invalid resume structure' }, { status: 500 });
  }

  const coverLetterObj: GeneratedCoverLetter = {
    text: parsed.cover_letter,
    tone: strategy.tone,
    language: analysis.detected_language,
    word_count: parsed.cover_letter.split(/\s+/).filter(Boolean).length,
  };

  const cost = estimateCost('premium', response.usage.input_tokens, response.usage.output_tokens);
  const existingUsage = pkg.ai_usage ?? { steps: [], total_cost_estimate: 0 };
  const newUsage: AiUsage = {
    steps: [
      ...existingUsage.steps,
      {
        step: 'generate',
        model: MODELS.premium,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        duration_ms: duration,
        cost_estimate: cost,
      },
    ],
    total_cost_estimate: existingUsage.total_cost_estimate + cost,
  };

  await updatePackage(supabase, package_id, user.id, {
    generated_resume: parsed.resume,
    generated_cover_letter: coverLetterObj,
    screening_questions: parsed.screening_questions,
    status: 'checkpoint_3',
    ai_usage: newUsage,
  });

  return NextResponse.json({
    generated_resume: parsed.resume,
    generated_cover_letter: coverLetterObj,
    screening_questions: parsed.screening_questions,
    ai_usage: newUsage,
  });
}
