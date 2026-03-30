import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { getPrimaryMarket } from '@/lib/data/markets';
import { getMarketConfig, DEFAULT_MARKET } from '@/lib/markets';
import type {
  SearchJobsResult,
  ApplicationStatusResult,
  ApplicationPackageData,
  ProfileSummaryData,
  WeeklyStatsResult,
  SearchAnswerLibraryResult,
  ApplicationBoardData,
  ResumePreviewData,
  InterviewPrepData,
  NavigateData,
  EmailDraftData,
  PracticeQuestionData,
  PracticeEvaluation,
  SearchInsightsResult,
  LinkedInShareData,
  SaveJobSearchResult,
  SaveJobToTrackerResult,
} from './types';
import { searchAdzunaLive } from './adzuna-search';
import { searchJobTechDev } from './jobtechdev-search';
import { fetchInsightsData } from './insights-data';
import { detectJobSearchStage } from './stage-detection';
import { detectPatterns } from './pattern-detection';

// ─── Tool 1: Search Jobs ────────────────────────────────────────────────────

export function searchJobsTool(userId: string) {
  return tool({
    description:
      "Search for jobs via live job market API. Defaults to Swedish jobs via Platsbanken (JobTechDev). Use when the user wants to find jobs, look for opportunities, or asks what's available. Returns real-time results from job boards.",
    inputSchema: zodSchema(
      z.object({
        query: z.string().describe('Job title or keywords to search for'),
        location: z.string().optional().describe('City or region filter (e.g. "Stockholm", "Göteborg")'),
        remoteType: z.enum(['remote', 'hybrid', 'onsite']).optional().describe('Remote type preference'),
        country: z.string().optional().describe('Country code — omit for Sweden (JobTechDev), or use "gb"/"us" etc. to search via Adzuna'),
        salaryMin: z.number().optional().describe('Minimum annual salary filter'),
        source: z.enum(['jobtechdev', 'adzuna']).optional().default('jobtechdev').describe('Job source: "jobtechdev" for Swedish jobs (default), "adzuna" for international'),
      })
    ),
    execute: async ({ query, location, remoteType, country, salaryMin, source }: {
      query: string;
      location?: string;
      remoteType?: 'remote' | 'hybrid' | 'onsite';
      country?: string;
      salaryMin?: number;
      source?: 'jobtechdev' | 'adzuna';
    }): Promise<SearchJobsResult> => {
      // Resolve source from user's primary market if not explicitly provided
      let useSource = source;
      let useCountry = country;
      if (!useSource) {
        const supabaseForMarket = await createClient();
        const primaryMarket = await getPrimaryMarket(supabaseForMarket, userId);
        const marketCode = primaryMarket?.market_code ?? DEFAULT_MARKET;
        const marketConfig = getMarketConfig(marketCode);
        if (marketConfig) {
          useSource = marketConfig.jobSources.primary === 'jobtechdev' ? 'jobtechdev' : 'adzuna';
          if (!useCountry) {
            useCountry = marketConfig.jobSources.adzunaCountry ?? marketCode.toLowerCase();
          }
        }
      }
      useSource = useSource ?? 'jobtechdev';

      // Step 1: Try live API search
      let liveResults: import('./types').JobResult[] | null = null;

      if (useSource === 'jobtechdev') {
        const { jobs, total } = await searchJobTechDev(userId, query, {
          location,
          remote: remoteType === 'remote',
          limit: 20,
        });
        if (jobs.length > 0) {
          let results = jobs;
          if (remoteType && remoteType !== 'remote') {
            const filtered = results.filter((r) => r.remoteType === remoteType);
            if (filtered.length > 0) results = filtered;
          }
          return { jobs: results.slice(0, 10), total, query, source: 'live' };
        }
      } else {
        liveResults = await searchAdzunaLive(userId, query, {
          location,
          country: useCountry ?? 'se',
          remote: remoteType === 'remote',
          salaryMin,
        });
      }

      if (liveResults && liveResults.length > 0) {
        let results = liveResults;

        // Filter by remoteType if hybrid/onsite (remote is handled by query)
        if (remoteType && remoteType !== 'remote') {
          const filtered = results.filter((r) => r.remoteType === remoteType);
          if (filtered.length > 0) results = filtered;
        }

        return {
          jobs: results.slice(0, 10),
          total: results.length,
          query,
          source: 'live',
        };
      }

      // Step 2: Fall back to cached DB results
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

      return { jobs, total: jobs.length, query, source: 'cached' };
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

// ─── Tool 7: Show Application Board ────────────────────────────────────────

export function showApplicationBoardTool(userId: string) {
  return tool({
    description:
      'Show the application kanban board inline. Use when the user wants to see their applications board, kanban, pipeline overview, or manage applications visually.',
    inputSchema: zodSchema(
      z.object({
        groupBy: z
          .enum(['status', 'company', 'date'])
          .optional()
          .default('status')
          .describe('How to group the applications'),
      })
    ),
    execute: async ({ groupBy }: { groupBy?: 'status' | 'company' | 'date' }): Promise<ApplicationBoardData> => {
      const supabase = await createClient();
      const { data: apps } = await supabase
        .from('applications')
        .select('id, company, role, status, updated_at, location, remote_type')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      const allApps = apps ?? [];
      const groupedCounts: Record<string, number> = {};
      const now = new Date();

      for (const app of allApps) {
        let key: string;
        if (groupBy === 'company') {
          key = app.company;
        } else if (groupBy === 'date') {
          key = new Date(app.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          key = app.status;
        }
        groupedCounts[key] = (groupedCounts[key] ?? 0) + 1;
      }

      const applications = allApps.map((a) => ({
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

      return {
        applications,
        groupedCounts,
        totalCount: applications.length,
        groupBy: groupBy ?? 'status',
      };
    },
  });
}

// ─── Tool 8: Show Resume Preview ────────────────────────────────────────────

export function showResumePreviewTool(userId: string) {
  return tool({
    description:
      "Show a preview of the user's resume. Use when the user asks to see their resume, check their resume, or wants to review their resume content.",
    inputSchema: zodSchema(
      z.object({
        resumeId: z.string().optional().describe('Specific resume ID (defaults to most recent)'),
      })
    ),
    execute: async ({ resumeId }: { resumeId?: string }): Promise<ResumePreviewData> => {
      const supabase = await createClient();

      const [resumeRes, profileRes, countRes] = await Promise.all([
        resumeId
          ? supabase.from('resumes').select('id, name, content').eq('id', resumeId).eq('user_id', userId).single()
          : supabase.from('resumes').select('id, name, content').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('user_profile_data').select('work_history, skills, contact_info').eq('user_id', userId).single(),
        supabase.from('resumes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      const resume = resumeRes.data;
      const profile = profileRes.data;
      const resumeCount = countRes.count ?? 0;

      // Extract data from resume content (JSONB with sections array)
      type SectionItem = Record<string, unknown>;
      type ResumeSection = { type: string; items?: SectionItem[] };
      const sections: ResumeSection[] = (resume?.content as { sections?: ResumeSection[] } | null)?.sections ?? [];

      const summarySection = sections.find((s) => s.type === 'summary');
      const summary = (summarySection?.items?.[0] as { text?: string } | undefined)?.text ?? null;

      const expSection = sections.find((s) => s.type === 'experience');
      const topExperiences = (expSection?.items ?? []).slice(0, 3).map((item) => {
        const exp = item as {
          company?: string; role?: string; startDate?: string; endDate?: string | null; bullets?: string[];
        };
        return {
          company: exp.company ?? '',
          role: exp.role ?? '',
          startDate: exp.startDate ?? '',
          endDate: exp.endDate ?? null,
          bullets: (exp.bullets ?? []).slice(0, 2),
        };
      });

      const skillsSection = sections.find((s) => s.type === 'skills');
      const skills = (skillsSection?.items ?? []).map((item) => {
        const s = item as { category?: string; skills?: string[] };
        return { category: s.category ?? 'Skills', items: s.skills ?? [] };
      });

      // Fall back to profile data if resume content is sparse
      const profileWork = (profile?.work_history as Array<{ title?: string; company?: string; startDate?: string; endDate?: string | null; bullets?: string[] }> | null) ?? [];
      const profileSkills = (profile?.skills as Array<{ category?: string; skills?: string[] }> | null) ?? [];
      const contactInfo = profile?.contact_info as Record<string, string> | null;

      const finalExperiences = topExperiences.length > 0
        ? topExperiences
        : profileWork.slice(0, 3).map((w) => ({
            company: w.company ?? '',
            role: w.title ?? '',
            startDate: w.startDate ?? '',
            endDate: w.endDate ?? null,
            bullets: (w.bullets ?? []).slice(0, 2),
          }));

      const finalSkills = skills.length > 0
        ? skills
        : profileSkills.map((g) => ({ category: g.category ?? 'Skills', items: g.skills ?? [] }));

      const currentTitle = profileWork[0]?.title ?? null;

      return {
        resumeId: resume?.id,
        resumeName: resume?.name ?? 'Resume',
        contactName: contactInfo?.name ?? null,
        contactEmail: contactInfo?.email ?? null,
        contactLocation: contactInfo?.location ?? null,
        currentTitle,
        summary,
        topExperiences: finalExperiences,
        skills: finalSkills,
        resumeCount,
      };
    },
  });
}

// ─── Tool 9: Show Interview Prep ────────────────────────────────────────────

export function showInterviewPrepTool(userId: string) {
  return tool({
    description:
      'Show interview preparation materials for an application. Use when the user wants to prepare for an interview, asks about interview prep, or wants practice questions for a specific company.',
    inputSchema: zodSchema(
      z.object({
        applicationId: z.string().optional().describe('Specific application ID'),
        company: z.string().optional().describe('Company name to look up'),
      })
    ),
    execute: async ({ applicationId, company }: { applicationId?: string; company?: string }): Promise<InterviewPrepData> => {
      const supabase = await createClient();

      // Find the application
      let appQuery = supabase
        .from('applications')
        .select('id, company, role, job_description')
        .eq('user_id', userId);

      if (applicationId) {
        appQuery = appQuery.eq('id', applicationId);
      } else if (company) {
        appQuery = appQuery.ilike('company', `%${company}%`);
      } else {
        appQuery = appQuery.in('status', ['interview', 'screening', 'applied']);
      }

      const { data: appData } = await appQuery.order('updated_at', { ascending: false }).limit(1).single();

      const appCompany = appData?.company ?? company ?? 'the company';
      const appRole = appData?.role ?? 'the role';
      const jobDescription = appData?.job_description ?? '';

      // Fetch user profile for personalization
      const [profileRes, summaryRes] = await Promise.all([
        supabase.from('user_profile_data').select('work_history, skills, summary').eq('user_id', userId).single(),
        supabase.from('knowledge_profile_summary').select('executive_summary, key_strengths').eq('user_id', userId).single(),
      ]);

      const profile = profileRes.data;
      const summary = summaryRes.data;

      const workHistory = (profile?.work_history as Array<{ title?: string; company?: string }> | null) ?? [];
      const skills = (profile?.skills as Array<{ skills?: string[] }> | null) ?? [];
      const skillsList = skills.flatMap((c) => c.skills ?? []).slice(0, 15).join(', ');

      const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const prompt = `Generate interview preparation materials for a job interview.

Company: ${appCompany}
Role: ${appRole}
${jobDescription ? `Job Description (excerpt):\n${jobDescription.slice(0, 1500)}` : ''}

Candidate Profile:
${summary?.executive_summary ? `Summary: ${summary.executive_summary}` : ''}
${summary?.key_strengths?.length ? `Strengths: ${summary.key_strengths.join(', ')}` : ''}
${skillsList ? `Skills: ${skillsList}` : ''}
${workHistory.length > 0 ? `Recent experience: ${workHistory[0]?.title ?? ''} at ${workHistory[0]?.company ?? ''}` : ''}

Generate a JSON response (no markdown fences) with this exact structure:
{
  "researchSummary": "<2-3 sentences about the company and what to highlight>",
  "questions": [
    {"question": "<interview question>", "answerOutline": "<key points to cover in 1-2 sentences>", "type": "<behavioral|technical|situational|motivational>"}
  ],
  "keyTalkingPoints": ["<talking point 1>", "<talking point 2>", "<talking point 3>", "<talking point 4>", "<talking point 5>"]
}

Generate exactly 5 likely interview questions tailored to this role.`;

      let result: { researchSummary: string; questions: Array<{ question: string; answerOutline: string; type: string }>; keyTalkingPoints: string[] };

      try {
        const response = await anthropicClient.messages.create({
          model: 'claude-sonnet-4-5-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        result = JSON.parse(clean);
      } catch {
        result = {
          researchSummary: `${appCompany} is hiring for a ${appRole} role. Focus on demonstrating your relevant experience and enthusiasm for the company's mission.`,
          questions: [
            { question: 'Tell me about yourself and your background.', answerOutline: 'Highlight relevant experience and skills that match this role.', type: 'motivational' },
            { question: `Why are you interested in ${appCompany}?`, answerOutline: 'Show research about the company and genuine enthusiasm.', type: 'motivational' },
            { question: 'Describe a challenging project you worked on.', answerOutline: 'Use STAR method: situation, task, action, result.', type: 'behavioral' },
            { question: 'Where do you see yourself in 5 years?', answerOutline: 'Align growth goals with the role and company trajectory.', type: 'situational' },
            { question: 'What are your greatest strengths?', answerOutline: 'Pick 2-3 strengths with concrete examples.', type: 'situational' },
          ],
          keyTalkingPoints: ['Relevant experience', 'Problem-solving ability', 'Team collaboration', 'Growth mindset', 'Company alignment'],
        };
      }

      return {
        company: appCompany,
        role: appRole,
        applicationId: appData?.id,
        researchSummary: result.researchSummary ?? '',
        questions: result.questions ?? [],
        keyTalkingPoints: result.keyTalkingPoints ?? [],
      };
    },
  });
}

// ─── Tool 10: Navigate To ────────────────────────────────────────────────────

const PAGE_MAP: Record<string, { url: string; pageName: string; description: string }> = {
  applications: {
    url: '/dashboard/applications',
    pageName: 'Applications',
    description: 'Kanban board — drag and drop applications between stages',
  },
  jobs: {
    url: '/dashboard/jobs',
    pageName: 'Jobs',
    description: 'Browse and save job listings from your searches',
  },
  draft: {
    url: '/dashboard/draft',
    pageName: 'Draft Application',
    description: 'Build a complete application package for a specific job',
  },
  answers: {
    url: '/dashboard/answers',
    pageName: 'Answer Library',
    description: 'Browse and manage your canonical screening question answers',
  },
  knowledge: {
    url: '/dashboard/knowledge',
    pageName: 'Knowledge Overview',
    description: 'Your professional knowledge profile and completeness',
  },
  resumes: {
    url: '/dashboard/resumes',
    pageName: 'Resumes',
    description: 'Manage, edit, and export your resumes',
  },
  emails: {
    url: '/dashboard/emails',
    pageName: 'Emails',
    description: 'Synced Gmail emails related to your applications',
  },
  profile: {
    url: '/dashboard/profile',
    pageName: 'Profile',
    description: 'Edit your profile and import resume data',
  },
  review: {
    url: '/dashboard/review',
    pageName: 'Weekly Review',
    description: 'Analytics and insights on your job search progress',
  },
  settings: {
    url: '/dashboard/settings',
    pageName: 'Settings',
    description: 'App settings, integrations, and preferences',
  },
  extension: {
    url: '/dashboard/extension',
    pageName: 'Browser Extension',
    description: 'Install and configure the browser autofill extension',
  },
};

export function navigateToTool() {
  return tool({
    description:
      'Navigate the user to a specific page in the app. Use when the user explicitly asks to go to a page, open something, or when a full-page view would be better than an inline component (e.g., for editing resumes, dragging kanban cards, or bulk operations).',
    inputSchema: zodSchema(
      z.object({
        page: z
          .enum(['applications', 'jobs', 'draft', 'answers', 'knowledge', 'resumes', 'emails', 'profile', 'review', 'settings', 'extension'])
          .describe('Which page to navigate to'),
        context: z.string().optional().describe('Additional context (e.g., application ID)'),
      })
    ),
    execute: async ({ page, context }: { page: string; context?: string }): Promise<NavigateData> => {
      const info = PAGE_MAP[page] ?? {
        url: '/dashboard',
        pageName: 'Dashboard',
        description: 'Main dashboard',
      };

      // Append context if provided (e.g., application ID as path param)
      const url = context && ['applications'].includes(page)
        ? `${info.url}/${context}`
        : info.url;

      return {
        url,
        pageName: info.pageName,
        description: info.description,
      };
    },
  });
}

// ─── Tool 11: Draft Follow-Up Email ─────────────────────────────────────────

export function draftFollowUpEmailTool(userId: string) {
  return tool({
    description:
      'Draft a follow-up email for a job application. Use when the user wants to follow up on an application, check in after not hearing back, or send a thank-you note after an interview.',
    inputSchema: zodSchema(
      z.object({
        applicationId: z.string().optional().describe('Specific application ID'),
        company: z.string().optional().describe('Company name to look up'),
        emailType: z
          .enum(['follow_up', 'thank_you', 'check_in'])
          .optional()
          .default('follow_up')
          .describe('Type of email to draft'),
        additionalContext: z
          .string()
          .optional()
          .describe('Any specific context to include (e.g., "I had the interview last Tuesday")'),
      })
    ),
    execute: async ({
      applicationId,
      company,
      emailType,
      additionalContext,
    }: {
      applicationId?: string;
      company?: string;
      emailType?: 'follow_up' | 'thank_you' | 'check_in';
      additionalContext?: string;
    }): Promise<EmailDraftData> => {
      const supabase = await createClient();

      // Find the application
      let appQuery = supabase
        .from('applications')
        .select('id, company, role, applied_at, updated_at, job_description')
        .eq('user_id', userId);

      if (applicationId) {
        appQuery = appQuery.eq('id', applicationId);
      } else if (company) {
        appQuery = appQuery.ilike('company', `%${company}%`);
      }

      const { data: appData } = await appQuery
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch user profile for sender name
      const { data: profileData } = await supabase
        .from('user_profile_data')
        .select('contact_info, work_history')
        .eq('user_id', userId)
        .single();

      const appCompany = appData?.company ?? company ?? 'the company';
      const appRole = appData?.role ?? 'the role';
      const appliedAt = appData?.applied_at ?? null;
      const daysSinceApplied = appliedAt
        ? Math.floor((Date.now() - new Date(appliedAt).getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const contactInfo = profileData?.contact_info as { name?: string; email?: string } | null;
      const senderName = contactInfo?.name ?? 'Your Name';

      const resolvedType = emailType ?? 'follow_up';
      const emailTypeLabels: Record<string, string> = {
        follow_up: 'follow-up',
        thank_you: 'thank-you after interview',
        check_in: 'check-in about timeline',
      };

      const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      const prompt = `Draft a professional ${emailTypeLabels[resolvedType]} email for a job application.

Application Details:
Company: ${appCompany}
Role: ${appRole}
${appliedAt ? `Applied: ${new Date(appliedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
${daysSinceApplied !== undefined ? `Days since applied: ${daysSinceApplied}` : ''}
${additionalContext ? `Additional context: ${additionalContext}` : ''}

Candidate: ${senderName}

Generate a JSON response (no markdown fences) with this exact structure:
{
  "subject": "<concise subject line>",
  "body": "<professional email body with proper greeting and sign-off, plain text>"
}

The email should be professional, concise (3-4 short paragraphs max), and warm. No HTML.`;

      let result: { subject: string; body: string };
      try {
        const response = await anthropicClient.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        result = JSON.parse(clean);
      } catch {
        const subjectMap: Record<string, string> = {
          follow_up: `Following Up — ${appRole} Application`,
          thank_you: `Thank You — ${appRole} Interview`,
          check_in: `Checking In — ${appRole} Application`,
        };
        result = {
          subject: subjectMap[resolvedType] ?? `Following Up — ${appRole} Application`,
          body: `Dear Hiring Manager,\n\nI wanted to follow up on my application for the ${appRole} position at ${appCompany}. I remain very interested in this opportunity and would welcome the chance to discuss my qualifications further.\n\nThank you for your time and consideration.\n\nBest regards,\n${senderName}`,
        };
      }

      return {
        company: appCompany,
        role: appRole,
        emailType: resolvedType,
        subject: result.subject ?? '',
        body: result.body ?? '',
        appliedAt,
        daysSinceApplied,
        contactEmail: null,
        applicationId: appData?.id,
      };
    },
  });
}

// ─── Tool 12: Practice Interview Question ───────────────────────────────────

export function practiceInterviewQuestionTool(userId: string) {
  return tool({
    description:
      'Ask the user a practice interview question and evaluate their answer. Use during interview prep practice sessions when the user wants to rehearse their responses. Start with questionIndex 0 and increment for each subsequent question.',
    inputSchema: zodSchema(
      z.object({
        company: z.string().describe('Company they are preparing for'),
        questionIndex: z
          .number()
          .describe('Which question to ask (0-4). Start at 0 for the first question.'),
        userAnswer: z
          .string()
          .optional()
          .describe(
            "The user's answer to evaluate. If not provided, just present the question."
          ),
      })
    ),
    execute: async ({
      company,
      questionIndex,
      userAnswer,
    }: {
      company: string;
      questionIndex: number;
      userAnswer?: string;
    }): Promise<PracticeQuestionData> => {
      const supabase = await createClient();

      // Find the application for role context
      const { data: appData } = await supabase
        .from('applications')
        .select('id, company, role, job_description')
        .eq('user_id', userId)
        .ilike('company', `%${company}%`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const appCompany = appData?.company ?? company;
      const appRole = appData?.role ?? 'the role';
      const jobDescription = appData?.job_description ?? '';

      const anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

      // Generate questions for this company/role
      const questionsPrompt = `Generate exactly 5 interview questions for a ${appRole} role at ${appCompany}.
${jobDescription ? `Job description excerpt:\n${jobDescription.slice(0, 800)}` : ''}

Return JSON (no markdown fences):
{"questions": [{"question": "<question text>", "type": "<behavioral|technical|situational|motivational>"}]}`;

      let questions: Array<{ question: string; type: string }> = [];
      try {
        const qRes = await anthropicClient.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: questionsPrompt }],
        });
        const qText = qRes.content[0].type === 'text' ? qRes.content[0].text : '';
        const qClean = qText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed = JSON.parse(qClean);
        questions = parsed.questions ?? [];
      } catch {
        questions = [
          { question: 'Tell me about yourself and your background.', type: 'motivational' },
          { question: `Why are you interested in ${appCompany}?`, type: 'motivational' },
          { question: 'Describe a challenging project you worked on.', type: 'behavioral' },
          { question: 'Where do you see yourself in 5 years?', type: 'situational' },
          { question: 'What are your greatest strengths?', type: 'situational' },
        ];
      }

      const totalQuestions = questions.length;
      const safeIndex = Math.max(0, Math.min(questionIndex, totalQuestions - 1));
      const currentQuestion = questions[safeIndex]?.question ?? 'Tell me about yourself.';
      const isLastQuestion = safeIndex >= totalQuestions - 1;

      if (!userAnswer) {
        return {
          company: appCompany,
          questionIndex: safeIndex,
          question: currentQuestion,
          totalQuestions,
          isLastQuestion,
        };
      }

      // Evaluate the user's answer
      const evalPrompt = `You are an interview coach. Evaluate this interview answer.

Question: ${currentQuestion}
Company: ${appCompany}
Role: ${appRole}
Candidate's Answer: ${userAnswer}

Evaluate on: relevance, specificity, use of concrete examples, conciseness.
Return JSON (no markdown fences):
{
  "score": "<strong|good|needs_work>",
  "feedback": "<2-3 sentence overall feedback>",
  "suggestions": ["<improvement suggestion 1>", "<improvement suggestion 2>"]
}`;

      let evaluation: PracticeEvaluation | undefined;
      try {
        const evalRes = await anthropicClient.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [{ role: 'user', content: evalPrompt }],
        });
        const evalText = evalRes.content[0].type === 'text' ? evalRes.content[0].text : '';
        const evalClean = evalText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        const parsedEval = JSON.parse(evalClean);
        evaluation = {
          score: (parsedEval.score as 'strong' | 'good' | 'needs_work') ?? 'good',
          feedback: parsedEval.feedback ?? '',
          suggestions: parsedEval.suggestions ?? [],
        };
      } catch {
        evaluation = {
          score: 'good',
          feedback:
            'Good effort! Consider adding more specific examples to strengthen your answer.',
          suggestions: [
            'Use the STAR method (Situation, Task, Action, Result)',
            'Add concrete metrics or outcomes to show impact',
          ],
        };
      }

      return {
        company: appCompany,
        questionIndex: safeIndex,
        question: currentQuestion,
        userAnswer,
        evaluation,
        totalQuestions,
        isLastQuestion,
      };
    },
  });
}

// ─── Tool 13: Get Search Insights ───────────────────────────────────────────

export function getSearchInsightsTool(userId: string) {
  return tool({
    description:
      'Surface patterns, trends, and recommendations from the user\'s job search data. Use when asked about search progress, trends, insights, "how\'s my search going", or when the user wants to understand their patterns.',
    inputSchema: zodSchema(
      z.object({
        focus: z
          .enum(['trends', 'patterns', 'recommendations', 'all'])
          .optional()
          .default('all')
          .describe('Which type of insights to surface'),
      })
    ),
    execute: async ({ focus }: { focus?: 'trends' | 'patterns' | 'recommendations' | 'all' }): Promise<SearchInsightsResult> => {
      const { applications, interactions } = await fetchInsightsData(userId);

      const stageContext = detectJobSearchStage(applications);
      let insights = detectPatterns(applications, interactions);

      // Filter by focus if specified
      if (focus && focus !== 'all') {
        const focusMap: Record<string, string[]> = {
          trends: ['trend'],
          patterns: ['pattern'],
          recommendations: ['recommendation', 'milestone'],
        };
        const allowed = focusMap[focus] ?? [];
        insights = insights.filter((i) => allowed.includes(i.type));
      }

      const stageLabels: Record<string, string> = {
        exploring: 'exploring opportunities',
        actively_applying: 'actively applying',
        interviewing: 'in the interview stage',
        negotiating: 'in offer negotiation',
        stalled: 'in a lull',
      };

      const summary = `User is ${stageLabels[stageContext.stage] ?? stageContext.stage}. ${stageContext.reason}. Weekly rate: ${stageContext.weeklyApplicationRate.toFixed(1)}/week.`;

      return {
        stage: {
          current: stageContext.stage,
          reason: stageContext.reason,
          daysSinceLastActivity: stageContext.daysSinceLastActivity,
          weeklyRate: stageContext.weeklyApplicationRate,
        },
        insights,
        summary,
      };
    },
  });
}

// ─── Tool 14: Share on LinkedIn ──────────────────────────────────────────────

export function shareOnLinkedInTool(userId: string) {
  return tool({
    description:
      'Show an inline LinkedIn share card when the user has a celebration-worthy milestone (interview invite, job offer, significant achievement). NEVER use for rejections, withdrawals, or negative events. Always show a pre-filled post the user can edit before sharing.',
    inputSchema: zodSchema(
      z.object({
        text: z.string().describe('Pre-filled post text for the user to review and edit before sharing. Should be celebratory, authentic, and include relevant hashtags.'),
        occasion: z.string().describe('Brief description of the occasion (e.g., "interview invite at Klarna", "job offer from Stripe")'),
      })
    ),
    execute: async ({ text, occasion }: { text: string; occasion: string }): Promise<LinkedInShareData> => {
      const supabase = await createClient();

      // Check if user has a LinkedIn connection
      const { data: connection } = await supabase
        .from('linkedin_connections')
        .select('id')
        .eq('user_id', userId)
        .single();

      return {
        text,
        occasion,
        isConnected: !!connection,
      };
    },
  });
}

// ─── Tool 15: Save Job Search ────────────────────────────────────────────────

export function saveJobSearchTool(userId: string) {
  return tool({
    description:
      'Save a job search so the system automatically discovers new matching listings daily. Use when the user wants to save a search, set up job alerts, or asks to be notified of new jobs.',
    inputSchema: zodSchema(
      z.object({
        name: z.string().describe('A short name for this search (e.g. "Product Manager Stockholm")'),
        query: z.string().describe('The search query / keywords'),
        location: z.string().optional().describe('Location filter'),
        remoteOnly: z.boolean().optional().default(false).describe('Only remote jobs'),
        country: z.string().optional().default('se').describe('Country code (e.g. "se", "gb", "us")'),
        salaryMin: z.number().optional().describe('Minimum salary filter'),
      })
    ),
    execute: async ({ name, query, location, remoteOnly, country, salaryMin }: {
      name: string;
      query: string;
      location?: string;
      remoteOnly?: boolean;
      country?: string;
      salaryMin?: number;
    }): Promise<SaveJobSearchResult> => {
      const { createSavedSearch } = await import('@/lib/data/saved-searches');

      const saved = await createSavedSearch(userId, {
        name,
        query,
        location: location ?? null,
        remote_only: remoteOnly ?? false,
        country: country ?? 'se',
        salary_min: salaryMin ?? null,
        is_active: true,
      });

      return {
        success: true,
        searchId: saved.id,
        name: saved.name,
        query: saved.query,
        message: `Search "${name}" saved! The system will check for new matches daily and you'll see them in your Discovered tab.`,
      };
    },
  });
}

// ─── Tool 16: Save Job to Tracker ────────────────────────────────────────────

export function saveJobToTrackerTool(userId: string) {
  return tool({
    description:
      'Save a specific job to the application tracker / kanban board. Use when the user wants to save a job, bookmark it, or add it to their tracker from search results.',
    inputSchema: zodSchema(
      z.object({
        title: z.string().describe('Job title'),
        company: z.string().describe('Company name'),
        url: z.string().optional().describe('Job posting URL'),
        location: z.string().optional().describe('Job location'),
        remoteType: z.enum(['remote', 'hybrid', 'onsite']).optional(),
        description: z.string().optional().describe('Job description text'),
        salaryRange: z.string().optional().describe('Salary range text'),
        externalId: z.string().optional().describe('External job ID from source system (e.g. Platsbanken/Adzuna job ID)'),
        source: z.enum(['platsbanken', 'jobtechdev', 'adzuna', 'linkedin', 'manual']).optional().default('manual').describe('Source platform the job was found on'),
      })
    ),
    execute: async ({ title, company, url, location, remoteType, description, salaryRange, externalId, source }: {
      title: string;
      company: string;
      url?: string;
      location?: string;
      remoteType?: 'remote' | 'hybrid' | 'onsite';
      description?: string;
      salaryRange?: string;
      externalId?: string;
      source?: 'platsbanken' | 'jobtechdev' | 'adzuna' | 'linkedin' | 'manual';
    }): Promise<SaveJobToTrackerResult> => {
      const supabase = await createClient();
      const { findOrCreateJobListing } = await import('@/lib/jobs/dedup');

      let dedupResult;
      try {
        dedupResult = await findOrCreateJobListing(supabase, {
          userId,
          title,
          company,
          url: url ?? `manual_${Date.now()}`,
          source: source ?? 'manual',
          externalId,
          description,
          location,
          remoteType: remoteType ?? 'unknown',
        });
      } catch {
        return { success: false, alreadyExists: false, message: 'Failed to save job.' };
      }

      // Already applied to this job
      if (dedupResult.alreadyApplied) {
        return {
          success: false,
          alreadyExists: true,
          alreadyApplied: true,
          applicationId: dedupResult.applicationId ?? undefined,
          jobListingId: dedupResult.jobListingId,
          message: `You already applied to "${title}" at ${company}.`,
          warningMessage: dedupResult.warningMessage,
        };
      }

      // Seen from another platform — check for existing application
      if (!dedupResult.isNew && dedupResult.applicationId) {
        return {
          success: false,
          alreadyExists: true,
          applicationId: dedupResult.applicationId,
          jobListingId: dedupResult.jobListingId,
          message: `You already have "${title}" at ${company} in your tracker.`,
          warningMessage: dedupResult.warningMessage,
        };
      }

      // Check for an existing application linked to this listing
      if (!dedupResult.isNew) {
        const { data: existingApp } = await supabase
          .from('applications')
          .select('id')
          .eq('user_id', userId)
          .eq('job_listing_id', dedupResult.jobListingId)
          .maybeSingle();

        if (existingApp) {
          return {
            success: false,
            alreadyExists: true,
            applicationId: existingApp.id,
            jobListingId: dedupResult.jobListingId,
            message: `You already have "${title}" at ${company} in your tracker.`,
            warningMessage: dedupResult.warningMessage,
          };
        }
      }

      const { data: app, error } = await supabase
        .from('applications')
        .insert({
          user_id: userId,
          company,
          role: title,
          url: url ?? null,
          location: location ?? null,
          remote_type: remoteType ?? null,
          job_description: description ?? null,
          salary_range: salaryRange ?? null,
          status: 'saved',
          job_listing_id: dedupResult.jobListingId,
        })
        .select('id')
        .single();

      if (error) {
        return { success: false, alreadyExists: false, message: 'Failed to save job.' };
      }

      // Link application back to the listing
      await supabase
        .from('job_listings')
        .update({ is_saved: true, application_id: app.id })
        .eq('id', dedupResult.jobListingId);

      return {
        success: true,
        alreadyExists: false,
        applicationId: app.id,
        jobListingId: dedupResult.jobListingId,
        message: `Saved "${title}" at ${company} to your tracker!`,
      };
    },
  });
}
