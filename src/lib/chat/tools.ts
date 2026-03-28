import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import type {
  SearchJobsResult,
  ApplicationStatusResult,
  ApplicationPackageData,
  ProfileSummaryData,
  WeeklyStatsResult,
  SearchAnswerLibraryResult,
} from './types';

// ─── Tool 1: Search Jobs ────────────────────────────────────────────────────

export function searchJobsTool(userId: string) {
  return tool({
    description:
      "Search for job listings matching criteria. Use when the user wants to find jobs, look for opportunities, or asks what's available.",
    inputSchema: zodSchema(
      z.object({
        query: z.string().describe('Job title or keywords to search for'),
        location: z.string().optional().describe('City or region filter'),
        remoteType: z.enum(['remote', 'hybrid', 'onsite']).optional().describe('Remote type preference'),
      })
    ),
    execute: async ({ query, location, remoteType }: { query: string; location?: string; remoteType?: 'remote' | 'hybrid' | 'onsite' }): Promise<SearchJobsResult> => {
      const supabase = await createClient();
      let dbQuery = supabase
        .from('job_listings')
        .select('*')
        .eq('user_id', userId)
        .order('match_score', { ascending: false })
        .limit(20);

      if (remoteType) {
        dbQuery = dbQuery.eq('remote_type', remoteType);
      }
      if (location) {
        dbQuery = dbQuery.ilike('location', `%${location}%`);
      }

      const { data: listings } = await dbQuery;

      let searchListings = listings ?? [];
      if (query) {
        const queryLower = query.toLowerCase();
        const keywords = queryLower.split(/\s+/).filter(Boolean);
        const filtered = searchListings.filter((l) => {
          const text = `${l.title} ${l.company} ${l.description ?? ''}`.toLowerCase();
          return keywords.some((kw) => text.includes(kw));
        });
        if (filtered.length > 0) searchListings = filtered;
      }

      const jobs = searchListings.slice(0, 10).map((l) => ({
        id: l.id,
        title: l.title,
        company: l.company,
        location: l.location,
        remoteType: l.remote_type as 'remote' | 'hybrid' | 'onsite' | 'unknown' | null,
        salary:
          l.salary_min && l.salary_max
            ? `${Math.round(l.salary_min / 1000)}k–${Math.round(l.salary_max / 1000)}k`
            : l.salary_min
              ? `${Math.round(l.salary_min / 1000)}k+`
              : null,
        matchScore: l.match_score,
        description: l.description ?? '',
        url: l.url,
        source: l.source,
        postedAt: l.posted_at,
      }));

      return { jobs, total: jobs.length, query };
    },
  });
}

// ─── Tool 2: Get Application Status ────────────────────────────────────────

export function getApplicationStatusTool(userId: string) {
  return tool({
    description:
      'Get the current status of all tracked job applications. Use when the user asks about their applications, pipeline, or how things are going.',
    inputSchema: zodSchema(
      z.object({
        status: z
          .enum(['all', 'saved', 'applied', 'screening', 'interview', 'offer', 'rejected'])
          .optional()
          .default('all')
          .describe('Filter by status'),
        limit: z.number().optional().default(10).describe('Max number of applications to return'),
      })
    ),
    execute: async ({ status, limit }: { status?: string; limit?: number }): Promise<ApplicationStatusResult> => {
      const supabase = await createClient();
      let query = supabase
        .from('applications')
        .select('id, company, role, status, updated_at, location, remote_type')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit ?? 10);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const [{ data: apps }, { data: allApps }] = await Promise.all([
        query,
        supabase.from('applications').select('status').eq('user_id', userId),
      ]);

      const counts = { saved: 0, applied: 0, screening: 0, interview: 0, offer: 0, rejected: 0, withdrawn: 0 };
      for (const a of allApps ?? []) {
        const s = a.status as keyof typeof counts;
        if (s in counts) counts[s]++;
      }

      const now = new Date();
      const applications = (apps ?? []).map((a) => ({
        id: a.id,
        company: a.company,
        role: a.role,
        status: a.status,
        updatedAt: a.updated_at,
        daysSinceUpdate: Math.floor(
          (now.getTime() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
        location: a.location,
        remoteType: a.remote_type,
      }));

      return { applications, counts };
    },
  });
}

// ─── Tool 3: Prepare Application ───────────────────────────────────────────

export function prepareApplicationTool(userId: string) {
  return tool({
    description:
      'Prepare a complete application package for a specific job. Generates a tailored resume summary, cover letter, and screening question answers. Use when the user wants to apply to a job, prepare an application, or draft materials for a position.',
    inputSchema: zodSchema(
      z.object({
        jobTitle: z.string().describe('The job title'),
        company: z.string().describe('The company name'),
        jobDescription: z.string().describe('The full job description text'),
        jobUrl: z.string().optional().describe('URL of the job listing'),
      })
    ),
    execute: async ({
      jobTitle, company, jobDescription, jobUrl,
    }: { jobTitle: string; company: string; jobDescription: string; jobUrl?: string }): Promise<ApplicationPackageData> => {
      const supabase = await createClient();

      const [profileRes, summaryRes, knowledgeRes, answersRes, existingAppRes] = await Promise.all([
        supabase.from('user_profile_data').select('*').eq('user_id', userId).single(),
        supabase
          .from('knowledge_profile_summary')
          .select('executive_summary, key_strengths, unique_value_proposition')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('knowledge_items')
          .select('category, title, content, tags')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('canonical_questions')
          .select('id, canonical_text, category, screening_answers(id, answer, rating, tone)')
          .eq('user_id', userId)
          .limit(20),
        supabase
          .from('applications')
          .select('id')
          .eq('user_id', userId)
          .eq('company', company)
          .eq('role', jobTitle)
          .maybeSingle(),
      ]);

      const profile = profileRes.data;
      const summary = summaryRes.data;
      const knowledgeItems = knowledgeRes.data ?? [];
      const libraryAnswers = answersRes.data ?? [];
      const existingApp = existingAppRes.data;

      let applicationId = existingApp?.id;
      let jobSaved = !!existingApp;

      if (!existingApp) {
        const { data: newApp } = await supabase
          .from('applications')
          .insert({
            user_id: userId,
            company,
            role: jobTitle,
            url: jobUrl ?? null,
            status: 'saved',
            job_description: jobDescription,
          })
          .select('id')
          .single();

        if (newApp) {
          applicationId = newApp.id;
          jobSaved = true;
          await supabase.from('application_events').insert({
            application_id: newApp.id,
            event_type: 'status_change',
            description: 'Application saved via chat assistant',
            metadata: { new_status: 'saved' },
          });
        }
      }

      const workHistory = profile?.work_history
        ? (profile.work_history as Array<{ title: string; company: string; startDate: string; endDate?: string | null; bullets?: string[] }>)
            .slice(0, 3)
            .map((w) => `${w.title} at ${w.company} (${w.startDate}–${w.endDate ?? 'Present'})\n${(w.bullets ?? []).slice(0, 3).join('\n')}`)
            .join('\n\n')
        : '';

      const skillsList = profile?.skills
        ? (profile.skills as Array<{ skills: string[] }>).flatMap((c) => c.skills).join(', ')
        : '';

      const knowledgeContext = knowledgeItems
        .slice(0, 15)
        .map((k) => `[${k.category}] ${k.title}: ${k.content}`)
        .join('\n');

      const libraryContext =
        libraryAnswers.length > 0
          ? '\n\nAnswer Library:\n' +
            libraryAnswers
              .map((q) => {
                const answers = (q.screening_answers as Array<{ rating: string; answer: string }> | null) ?? [];
                const best = answers.find((a) => a.rating === 'strong') ?? answers[0];
                return best ? `Q: ${q.canonical_text}\nA: ${best.answer}` : null;
              })
              .filter(Boolean)
              .join('\n\n')
          : '';

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const prompt = `You are an expert career coach helping prepare a job application package.

## Job Details
Company: ${company}
Role: ${jobTitle}
Job Description:
${jobDescription.slice(0, 3000)}

## Candidate Profile
${summary?.executive_summary ? `Summary: ${summary.executive_summary}` : ''}
${summary?.key_strengths?.length ? `Strengths: ${summary.key_strengths.join(', ')}` : ''}
${skillsList ? `Skills: ${skillsList}` : ''}

Work History:
${workHistory}

Knowledge Base:
${knowledgeContext}
${libraryContext}

Generate a JSON response (no markdown fences) with this exact structure:
{
  "matchScore": <0-100 integer>,
  "resumeChanges": [<3-5 specific tailoring suggestions>],
  "coverLetter": "<professional cover letter, 3-4 paragraphs>",
  "screeningAnswers": [
    {"question": "<likely screening question>", "answer": "<tailored answer>", "source": "<'answer_library' if from library, null otherwise>"}
  ]
}

Extract 3-5 likely screening questions from the JD.`;

      let result;
      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        result = JSON.parse(clean);
      } catch {
        result = {
          matchScore: 70,
          resumeChanges: [`Highlight experience relevant to ${jobTitle} at ${company}`, 'Add keywords from the JD to your skills section', 'Quantify achievements'],
          coverLetter: `Dear Hiring Manager,\n\nI am excited to apply for the ${jobTitle} position at ${company}.\n\nBest regards`,
          screeningAnswers: [],
        };
      }

      return {
        company,
        role: jobTitle,
        matchScore: result.matchScore ?? 70,
        resumeChanges: result.resumeChanges ?? [],
        coverLetter: result.coverLetter ?? '',
        screeningAnswers: result.screeningAnswers ?? [],
        jobSaved,
        applicationId,
      };
    },
  });
}

// ─── Tool 4: Get Profile Summary ───────────────────────────────────────────

export function getProfileSummaryTool(userId: string) {
  return tool({
    description:
      "Show the user's professional profile summary, strengths, and knowledge completeness. Use when the user asks about their profile, wants to see their strengths, or asks what the system knows about them.",
    inputSchema: zodSchema(z.object({})),
    execute: async (): Promise<ProfileSummaryData> => {
      const supabase = await createClient();

      const [summaryRes, itemsRes, profileRes] = await Promise.all([
        supabase
          .from('knowledge_profile_summary')
          .select('executive_summary, key_strengths, completeness_scores, knowledge_item_count')
          .eq('user_id', userId)
          .single(),
        supabase.from('knowledge_items').select('category').eq('user_id', userId).eq('is_active', true),
        supabase.from('user_profile_data').select('summary, work_history').eq('user_id', userId).single(),
      ]);

      const summary = summaryRes.data;
      const items = itemsRes.data ?? [];
      const profile = profileRes.data;

      const categoryCounts: Record<string, number> = {};
      for (const item of items) {
        categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
      }

      const completenessScores = (summary?.completeness_scores ?? {}) as Record<string, number>;
      const LABELS: Record<string, string> = {
        fact: 'Facts', skill: 'Skills', achievement: 'Achievements', story: 'Stories',
        value: 'Values', preference: 'Preferences', philosophy: 'Philosophy', self_assessment: 'Self Assessment',
      };

      const categories = Object.entries(LABELS).map(([key, label]) => ({
        name: label,
        count: categoryCounts[key] ?? 0,
        completeness: Math.round((completenessScores[key] ?? 0) * 100),
      }));

      const workHistory = profile?.work_history as Array<{ title?: string }> | null;
      const currentTitle = Array.isArray(workHistory) && workHistory.length > 0
        ? workHistory[0]?.title ?? null
        : null;

      return {
        summary: summary?.executive_summary ?? profile?.summary ?? 'No profile summary yet. Complete the knowledge interview to build your profile.',
        strengths: (summary?.key_strengths ?? []) as string[],
        categories,
        totalKnowledgeItems: items.length,
        currentTitle,
      };
    },
  });
}

// ─── Tool 5: Get Weekly Stats ──────────────────────────────────────────────

export function getWeeklyStatsTool(userId: string) {
  return tool({
    description:
      "Show weekly job search statistics and progress. Use when the user asks how they're doing, wants a status update, or asks about their week.",
    inputSchema: zodSchema(
      z.object({
        period: z.enum(['week', 'month']).optional().default('week').describe('Time period'),
      })
    ),
    execute: async ({ period }: { period?: 'week' | 'month' }): Promise<WeeklyStatsResult> => {
      const supabase = await createClient();

      const days = period === 'month' ? 30 : 7;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const prevSince = new Date(Date.now() - days * 2 * 24 * 60 * 60 * 1000);

      const { data: apps } = await supabase
        .from('applications')
        .select('id, status, applied_at, updated_at, created_at')
        .eq('user_id', userId);

      const allApps = apps ?? [];
      const appsSubmitted = allApps.filter((a) => a.applied_at && new Date(a.applied_at) >= since).length;
      const prevSubmitted = allApps.filter(
        (a) => a.applied_at && new Date(a.applied_at) >= prevSince && new Date(a.applied_at) < since
      ).length;

      const respondedStatuses = new Set(['screening', 'interview', 'offer']);
      const activeStatuses = new Set(['applied', 'screening', 'interview', 'offer']);
      const activeApplications = allApps.filter((a) => activeStatuses.has(a.status)).length;
      const responsesReceived = allApps.filter((a) => respondedStatuses.has(a.status)).length;
      const interviewInvitations = allApps.filter((a) => ['interview', 'offer'].includes(a.status)).length;
      const rejections = allApps.filter((a) => a.status === 'rejected').length;
      const totalApplied = allApps.filter((a) => a.status !== 'saved').length;
      const responseRate = totalApplied > 0 ? Math.round((responsesReceived / totalApplied) * 100) : null;
      const staleApps = allApps.filter(
        (a) => ['applied', 'screening'].includes(a.status) &&
          new Date(a.updated_at) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      ).length;

      let insight: string | undefined;
      if (appsSubmitted > prevSubmitted && prevSubmitted > 0) {
        const pct = Math.round(((appsSubmitted - prevSubmitted) / prevSubmitted) * 100);
        insight = `You applied ${pct}% more this ${period === 'month' ? 'month' : 'week'} vs last ${period === 'month' ? 'month' : 'week'}.`;
      } else if (responseRate !== null && responseRate > 20) {
        insight = `Your response rate of ${responseRate}% is above average — great work!`;
      } else if (staleApps > 0) {
        insight = `${staleApps} application${staleApps > 1 ? 's have' : ' has'} had no updates in 2+ weeks.`;
      }

      return {
        period: period ?? 'week',
        stats: {
          period: period ?? 'week',
          appsSubmitted,
          responsesReceived,
          interviewInvitations,
          rejections,
          responseRate,
          activeApplications,
          staleApplications: staleApps,
        },
        insight,
      };
    },
  });
}

// ─── Tool 6: Search Answer Library ────────────────────────────────────────

export function searchAnswerLibraryTool(userId: string) {
  return tool({
    description:
      "Search the user's answer library for previously written answers. Use when the user asks about their answers, wants to find a specific answer, or needs to recall what they've said before.",
    inputSchema: zodSchema(
      z.object({
        query: z.string().describe('Topic or keyword to search for'),
        category: z.string().optional().describe('Filter by category'),
      })
    ),
    execute: async ({ query, category }: { query: string; category?: string }): Promise<SearchAnswerLibraryResult> => {
      const supabase = await createClient();

      let q = supabase
        .from('canonical_questions')
        .select('id, canonical_text, category, tags, screening_answers(id, answer, rating, tone, usage_count)')
        .eq('user_id', userId);

      if (category) q = q.eq('category', category);
      if (query) q = q.ilike('canonical_text', `%${query}%`);

      const { data: questions } = await q.limit(10);

      const ratingScore = { strong: 3, good: 2, needs_work: 1, untested: 0 };

      const answers = (questions ?? []).flatMap((qq) => {
        const qAnswers = (qq.screening_answers as Array<{ id: string; answer: string; rating: string; tone: string; usage_count: number }> | null) ?? [];
        const best = qAnswers.sort((a, b) =>
          (ratingScore[b.rating as keyof typeof ratingScore] ?? 0) -
          (ratingScore[a.rating as keyof typeof ratingScore] ?? 0)
        )[0];
        if (!best) return [];
        return [{ id: qq.id, question: qq.canonical_text, answer: best.answer, category: qq.category, rating: best.rating, tone: best.tone, usageCount: best.usage_count }];
      });

      return { answers, total: answers.length, query };
    },
  });
}
