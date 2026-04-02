import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { MODELS, estimateCost } from '@/lib/config/models';
import { createPackage, updatePackage } from '@/lib/data/application-studio';
import type { JobAnalysis, CompanyResearch, AiUsageStep } from '@/lib/types/database';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_listing_id } = await req.json();
  if (!job_listing_id) return NextResponse.json({ error: 'job_listing_id required' }, { status: 400 });

  // Fetch job listing
  const { data: job, error: jobErr } = await supabase
    .from('job_listings')
    .select('*')
    .eq('id', job_listing_id)
    .single();
  if (jobErr || !job) return NextResponse.json({ error: 'Job listing not found' }, { status: 404 });

  // Fetch user profile for context
  const { data: profileData } = await supabase
    .from('user_profile_data')
    .select('summary, work_history, skills')
    .eq('user_id', user.id)
    .single();

  // Check for existing applications at same company
  const { data: existingApps } = await supabase
    .from('applications')
    .select('role, status, created_at')
    .eq('user_id', user.id)
    .ilike('company', `%${job.company}%`)
    .order('created_at', { ascending: false })
    .limit(5);

  // Create the package record
  const pkg = await createPackage(supabase, user.id, job_listing_id);

  // Prepare description (truncate to 8000 chars for Haiku)
  const description = (job.description || '').slice(0, 8000);
  const profileContext = profileData
    ? `User summary: ${(profileData.summary || '').slice(0, 500)}\nTop skills: ${
        (profileData.skills || []).flatMap((c: { skills: string[] }) => c.skills).slice(0, 20).join(', ')
      }\nRecent roles: ${
        (profileData.work_history || []).slice(0, 3).map((w: { title: string; company: string }) => `${w.title} at ${w.company}`).join(', ')
      }`
    : 'No profile data available yet.';

  const existingAppsContext = existingApps?.length
    ? `\nUser has ${existingApps.length} existing application(s) at ${job.company}: ${existingApps.map((a: { role: string; status: string }) => `${a.role} (${a.status})`).join(', ')}`
    : '';

  // Run two Haiku calls in parallel
  const aiSteps: AiUsageStep[] = [];

  const [analysisResult, researchResult] = await Promise.all([
    // STEP 1: Job Analysis
    (async () => {
      const start = Date.now();
      const resp = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `You are a career analyst. Parse this job description and extract structured information.

## Job Details
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}
Remote type: ${job.remote_type || 'Not specified'}
ATS type: ${job.ats_type || 'Unknown'}
Required skills listed: ${(job.required_skills || []).join(', ') || 'None listed'}

## Job Description
${description}

## Instructions
Return a JSON object with these fields:
{
  "requirements": [{ "text": "requirement description", "category": "must_have" | "nice_to_have" | "inferred", "priority": 1-5 }],
  "keywords": [{ "keyword": "term", "frequency": 1-5, "category": "skill" | "tool" | "trait" | "domain" }],
  "role_level": "junior" | "mid" | "senior" | "lead" | "director" | "executive",
  "role_family": "e.g. product_management, engineering, sales, gtm, marketing, design, operations",
  "employment_type": "e.g. Full-time, Part-time, Contract",
  "detected_language": "en" | "sv" | "no" | "de",
  "culture_signals": [{ "signal": "what you detected", "evidence": "text from JD that suggests this" }],
  "ats_type": "${job.ats_type || 'null'}"
}

Rules:
- Extract 8-15 requirements, ranked by priority (5 = most critical)
- "must_have" = explicitly stated requirements; "nice_to_have" = mentioned as preferred/bonus; "inferred" = not stated but clearly implied by the role
- Extract 10-25 keywords covering skills, tools, traits, and domain terms
- Detect the language of the JD itself (not the company's country)
- Culture signals: look for hints about company culture (startup energy, corporate, collaborative, fast-paced, etc.)
- Return ONLY the JSON object, no markdown, no explanation`
        }]
      });
      const duration = Date.now() - start;
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
      aiSteps.push({
        step: 'job_analysis',
        model: MODELS.fast,
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        duration_ms: duration,
        cost_estimate: estimateCost('fast', resp.usage.input_tokens, resp.usage.output_tokens),
      });
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as JobAnalysis;
    })(),

    // STEP 2: Company Research
    (async () => {
      const start = Date.now();
      const resp = await anthropic.messages.create({
        model: MODELS.fast,
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are a company researcher for a job seeker. Based on the job description below, extract everything you can about the company to help personalize an application.

## Job Details
Title: ${job.title}
Company: ${job.company}
Location: ${job.location || 'Not specified'}

## Job Description
${description}

## Applicant Context
${profileContext}${existingAppsContext}

## Instructions
Return a JSON object:
{
  "company_name": "${job.company}",
  "industry": "the company's primary industry",
  "company_size": "startup" | "scaleup" | "mid_market" | "enterprise" | "unknown",
  "growth_stage": "brief description of growth stage based on clues in the JD",
  "culture_notes": "2-3 sentences about company culture based on JD language, benefits, values mentioned",
  "values": ["value1", "value2", "value3"],
  "recent_news": null,
  "why_interesting": "1-2 sentences explaining why this role is specifically interesting for THIS applicant based on their profile"
}

Rules:
- Infer company size from employee count mentions, department structure, or industry norms
- Extract values from "our values", "we believe in", "we're looking for people who" sections
- The "why_interesting" field MUST be personalized based on the applicant context provided
- Return ONLY the JSON, no markdown`
        }]
      });
      const duration = Date.now() - start;
      const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
      aiSteps.push({
        step: 'company_research',
        model: MODELS.fast,
        input_tokens: resp.usage.input_tokens,
        output_tokens: resp.usage.output_tokens,
        duration_ms: duration,
        cost_estimate: estimateCost('fast', resp.usage.input_tokens, resp.usage.output_tokens),
      });
      return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as CompanyResearch;
    })(),
  ]);

  // Update the package with results
  const totalCost = aiSteps.reduce((sum, s) => sum + s.cost_estimate, 0);
  const updated = await updatePackage(supabase, pkg.id, user.id, {
    status: 'checkpoint_1',
    job_analysis: analysisResult,
    company_research: researchResult,
    ai_usage: { steps: aiSteps, total_cost_estimate: totalCost },
  });

  return NextResponse.json({
    package_id: updated.id,
    job_analysis: analysisResult,
    company_research: researchResult,
    ai_usage: { steps: aiSteps, total_cost_estimate: totalCost },
  });
}
