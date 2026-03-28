import type { JobSearchStage } from './stage-detection';

export interface Suggestion {
  text: string;
  action: string;
  priority: number;
}

interface ApplicationSummary {
  id: string;
  company: string;
  role: string;
  status: string;
  daysSinceUpdate: number;
}

interface WeeklyStats {
  appsSubmitted: number;
  responseRate: number | null;
}

interface SavedSearch {
  id: string;
}

interface RecentInteraction {
  interaction_type: string;
  action_text: string | null;
  tool_name: string | null;
  created_at: string;
}

export interface SuggestionInput {
  applications: ApplicationSummary[];
  weeklyStats: WeeklyStats;
  savedSearches: SavedSearch[];
  knowledgeCompleteness?: number;
  stage?: JobSearchStage;
  recentInteractions?: RecentInteraction[];
}

// Count interactions by first word of action_text in the last 7 days
function getOverusedActionPrefixes(interactions: RecentInteraction[]): Set<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const counts: Record<string, number> = {};

  for (const i of interactions) {
    if (
      i.interaction_type === 'suggestion_click' &&
      i.action_text &&
      new Date(i.created_at) >= sevenDaysAgo
    ) {
      const prefix = i.action_text.split(' ')[0].toLowerCase();
      counts[prefix] = (counts[prefix] ?? 0) + 1;
    }
  }

  return new Set(Object.entries(counts).filter(([, count]) => count > 3).map(([prefix]) => prefix));
}

function adjustPriority(basePriority: number, text: string, overused: Set<string>): number {
  const prefix = text.split(' ')[0].toLowerCase();
  if (overused.has(prefix)) return basePriority + 2;
  return basePriority;
}

export function generateSuggestions(data: SuggestionInput): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const stage = data.stage ?? 'exploring';
  const overused = data.recentInteractions
    ? getOverusedActionPrefixes(data.recentInteractions)
    : new Set<string>();

  const staleApps = data.applications.filter(
    (a) => ['applied', 'screening'].includes(a.status) && a.daysSinceUpdate >= 7
  );
  const interviews = data.applications.filter((a) => a.status === 'interview');
  const offers = data.applications.filter((a) => a.status === 'offer');

  if (stage === 'exploring') {
    // P1: Search for jobs
    suggestions.push({
      text: 'Search for jobs matching your profile',
      action: 'Search for jobs matching my profile and preferences',
      priority: adjustPriority(1, 'Search', overused),
    });
    // P2: Incomplete profile
    if (data.knowledgeCompleteness !== undefined && data.knowledgeCompleteness < 60) {
      suggestions.push({
        text: `Knowledge profile ${data.knowledgeCompleteness}% complete — strengthen it`,
        action: 'What knowledge topics should I focus on completing?',
        priority: adjustPriority(2, 'Knowledge', overused),
      });
    }
    // P3: Gentle velocity nudge
    if (data.applications.filter((a) => a.status !== 'saved').length > 0) {
      suggestions.push({
        text: 'Ready to start applying? Review your pipeline',
        action: 'Show me my application board',
        priority: adjustPriority(3, 'Ready', overused),
      });
    }
  } else if (stage === 'actively_applying') {
    // P1: Stale followups
    if (staleApps.length > 0) {
      const app = staleApps[0];
      suggestions.push({
        text: `Follow up on your ${app.company} application (${app.daysSinceUpdate}d old)`,
        action: `I need to follow up on my application at ${app.company} for ${app.role}`,
        priority: adjustPriority(1, 'Follow', overused),
      });
    }
    // P2: Interview prep if any
    if (interviews.length > 0) {
      const app = interviews[0];
      suggestions.push({
        text: `Prepare for your ${app.company} interview`,
        action: `Help me prepare for my interview at ${app.company} for the ${app.role} position`,
        priority: adjustPriority(2, 'Prepare', overused),
      });
    }
    // P3: Low velocity
    if (data.weeklyStats.appsSubmitted < 2) {
      suggestions.push({
        text: `Only ${data.weeklyStats.appsSubmitted} application${data.weeklyStats.appsSubmitted === 1 ? '' : 's'} this week — find more?`,
        action: 'Search for jobs matching my profile and preferences',
        priority: adjustPriority(3, 'Only', overused),
      });
    }
    // Response rate insight
    if (data.weeklyStats.responseRate !== null && data.weeklyStats.responseRate < 10) {
      suggestions.push({
        text: `${data.weeklyStats.responseRate}% response rate — refine your applications?`,
        action: 'How can I improve my application response rate?',
        priority: adjustPriority(4, `${data.weeklyStats.responseRate}%`, overused),
      });
    }
  } else if (stage === 'interviewing') {
    // P1: Interview prep
    if (interviews.length > 0) {
      const app = interviews[0];
      suggestions.push({
        text: `Prepare for your ${app.company} interview`,
        action: `Help me prepare for my interview at ${app.company} for the ${app.role} position`,
        priority: adjustPriority(1, 'Prepare', overused),
      });
    }
    // P2: Practice questions
    suggestions.push({
      text: 'Practice mock interview questions',
      action: 'Let me practice interview questions for my upcoming interview',
      priority: adjustPriority(2, 'Practice', overused),
    });
    // P3: Stale follow-ups (lower priority in interview stage)
    if (staleApps.length > 0) {
      const app = staleApps[0];
      suggestions.push({
        text: `Follow up on your ${app.company} application`,
        action: `Draft a follow-up email for my ${app.company} application`,
        priority: adjustPriority(3, 'Follow', overused),
      });
    }
  } else if (stage === 'negotiating') {
    // P1: Compare/evaluate offers
    if (offers.length > 0) {
      suggestions.push({
        text: `Evaluate your ${offers[0].company} offer`,
        action: `Help me evaluate my job offer from ${offers[0].company}`,
        priority: adjustPriority(1, 'Evaluate', overused),
      });
    }
    // P2: Salary research
    suggestions.push({
      text: 'Research market salary data',
      action: 'Help me research salary ranges for my role and experience level',
      priority: adjustPriority(2, 'Research', overused),
    });
    // P3: Negotiation email
    suggestions.push({
      text: 'Draft a negotiation email',
      action: 'Help me draft a salary negotiation email',
      priority: adjustPriority(3, 'Draft', overused),
    });
  } else if (stage === 'stalled') {
    // P1: Re-engagement
    const daysSince = data.applications.length > 0
      ? Math.max(
          ...data.applications
            .filter((a) => a.status !== 'saved')
            .map((a) => a.daysSinceUpdate)
        )
      : 0;
    suggestions.push({
      text: daysSince > 0 ? `It's been ${daysSince} days — find new matches` : 'Find new job matches',
      action: 'Search for jobs matching my profile and preferences',
      priority: adjustPriority(1, "It's", overused),
    });
    // P2: Insights review
    suggestions.push({
      text: 'Review what worked — see your search insights',
      action: "How's my job search going? What patterns do you notice?",
      priority: adjustPriority(2, 'Review', overused),
    });
    // P3: Refresh resume
    suggestions.push({
      text: 'Refresh your resume',
      action: 'Show me my resume and suggest improvements',
      priority: adjustPriority(3, 'Refresh', overused),
    });
  }

  // Always add: incomplete profile if very low completeness and not already in list
  if (
    stage !== 'exploring' &&
    data.knowledgeCompleteness !== undefined &&
    data.knowledgeCompleteness < 40
  ) {
    suggestions.push({
      text: `Knowledge profile ${data.knowledgeCompleteness}% complete — add more`,
      action: 'What knowledge topics should I focus on completing?',
      priority: adjustPriority(5, 'Knowledge', overused),
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
