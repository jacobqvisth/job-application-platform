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

export interface SuggestionInput {
  applications: ApplicationSummary[];
  weeklyStats: WeeklyStats;
  savedSearches: SavedSearch[];
  knowledgeCompleteness?: number;
}

export function generateSuggestions(data: SuggestionInput): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Priority 1: Stale applications (7+ days no update in applied/screening)
  const staleApps = data.applications.filter(
    (a) => ["applied", "screening"].includes(a.status) && a.daysSinceUpdate >= 7
  );
  if (staleApps.length > 0) {
    const app = staleApps[0];
    suggestions.push({
      text: `Follow up on your ${app.company} application (${app.daysSinceUpdate}d old)`,
      action: `I need to follow up on my application at ${app.company} for ${app.role}`,
      priority: 1,
    });
  }

  // Priority 2: Upcoming interviews (prep needed)
  const interviews = data.applications.filter((a) => a.status === "interview");
  if (interviews.length > 0) {
    const app = interviews[0];
    suggestions.push({
      text: `Prepare for your ${app.company} interview`,
      action: `Help me prepare for my interview at ${app.company} for the ${app.role} position`,
      priority: 2,
    });
  }

  // Priority 3: Low application velocity
  if (data.weeklyStats.appsSubmitted < 2) {
    suggestions.push({
      text: `Only ${data.weeklyStats.appsSubmitted} application${data.weeklyStats.appsSubmitted === 1 ? "" : "s"} this week — find more?`,
      action: "Search for jobs matching my profile and preferences",
      priority: 3,
    });
  }

  // Priority 4: Response rate below average
  if (data.weeklyStats.responseRate !== null && data.weeklyStats.responseRate < 10) {
    suggestions.push({
      text: `${data.weeklyStats.responseRate}% response rate — refine your applications?`,
      action: "How can I improve my application response rate?",
      priority: 4,
    });
  }

  // Priority 5: Incomplete profile
  if (data.knowledgeCompleteness !== undefined && data.knowledgeCompleteness < 60) {
    suggestions.push({
      text: `Knowledge profile ${data.knowledgeCompleteness}% complete — add more`,
      action: "What knowledge topics should I focus on completing?",
      priority: 5,
    });
  }

  return suggestions.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
