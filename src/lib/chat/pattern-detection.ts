export interface SearchInsight {
  type: 'trend' | 'pattern' | 'recommendation' | 'milestone';
  title: string;      // short headline, e.g. "Response rate improving"
  description: string; // 1-2 sentence explanation
  metric?: string;     // e.g. "23% → 31%"
  priority: number;    // 1 = most important
  actionable: boolean; // true if there's a concrete next step
  suggestedAction?: string; // message to send to chat
}

interface ApplicationRow {
  id: string;
  status: string;
  updated_at: string;
  applied_at?: string | null;
  company?: string;
  role?: string;
}

interface InteractionRow {
  interaction_type: string;
  action_text: string | null;
  tool_name: string | null;
  created_at: string;
}

export function detectPatterns(
  applications: ApplicationRow[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interactions: InteractionRow[]
): SearchInsight[] {
  const insights: SearchInsight[] = [];
  const now = new Date();

  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const respondedStatuses = new Set(['screening', 'interview', 'offer']);
  const nonSavedApps = applications.filter((a) => a.status !== 'saved');

  // ─── 1. Response rate trend ────────────────────────────────────────────────
  const appsInLastTwo = nonSavedApps.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= twoWeeksAgo
  );
  const appsInPriorTwo = nonSavedApps.filter((a) => {
    if (!a.applied_at) return false;
    const d = new Date(a.applied_at);
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  });

  if (appsInLastTwo.length >= 3 && appsInPriorTwo.length >= 3) {
    const recentResponded = appsInLastTwo.filter((a) => respondedStatuses.has(a.status)).length;
    const priorResponded = appsInPriorTwo.filter((a) => respondedStatuses.has(a.status)).length;
    const recentRate = Math.round((recentResponded / appsInLastTwo.length) * 100);
    const priorRate = Math.round((priorResponded / appsInPriorTwo.length) * 100);
    const diff = recentRate - priorRate;

    if (Math.abs(diff) >= 5) {
      if (diff > 0) {
        insights.push({
          type: 'trend',
          title: 'Response rate improving',
          description: `Your response rate has gone up recently — more companies are engaging with your applications.`,
          metric: `${priorRate}% → ${recentRate}%`,
          priority: 2,
          actionable: false,
        });
      } else {
        insights.push({
          type: 'trend',
          title: 'Response rate dipping',
          description: `Your response rate has declined. It may be worth reviewing your application materials or targeting different roles.`,
          metric: `${priorRate}% → ${recentRate}%`,
          priority: 2,
          actionable: true,
          suggestedAction: 'How can I improve my application response rate?',
        });
      }
    }
  }

  // ─── 2. Application velocity ───────────────────────────────────────────────
  const appsLastTwoWeeks = nonSavedApps.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= twoWeeksAgo
  ).length;
  const appsPriorTwoWeeks = nonSavedApps.filter((a) => {
    if (!a.applied_at) return false;
    const d = new Date(a.applied_at);
    return d >= fourWeeksAgo && d < twoWeeksAgo;
  }).length;

  if (appsLastTwoWeeks >= 2 && appsPriorTwoWeeks >= 2) {
    const change = appsLastTwoWeeks / appsPriorTwoWeeks;
    if (change > 1.5) {
      insights.push({
        type: 'trend',
        title: 'Momentum building',
        description: `You're submitting significantly more applications this period — great consistency.`,
        metric: `${appsPriorTwoWeeks} → ${appsLastTwoWeeks} (last 2 weeks)`,
        priority: 4,
        actionable: false,
      });
    } else if (change < 0.5) {
      insights.push({
        type: 'trend',
        title: 'Application pace slowed',
        description: `Your application rate has dropped compared to the previous two weeks. Ready to pick things up?`,
        metric: `${appsPriorTwoWeeks} → ${appsLastTwoWeeks} (last 2 weeks)`,
        priority: 3,
        actionable: true,
        suggestedAction: 'Search for jobs matching my profile and preferences',
      });
    }
  }

  // ─── 3. Stage distribution: most apps stuck in applied ────────────────────
  const appliedApps = applications.filter((a) => a.status === 'applied');
  const totalNonSaved = nonSavedApps.length;
  if (totalNonSaved >= 5 && appliedApps.length / totalNonSaved > 0.6) {
    insights.push({
      type: 'pattern',
      title: 'Most applications stuck at Applied',
      description: `${Math.round((appliedApps.length / totalNonSaved) * 100)}% of your applications haven't progressed past "Applied". Consider following up or refining your targeting.`,
      metric: `${appliedApps.length}/${totalNonSaved} apps`,
      priority: 3,
      actionable: true,
      suggestedAction: 'Help me follow up on my stale applications',
    });
  }

  // ─── 4. Stale application alert ───────────────────────────────────────────
  const staleApps = applications.filter((a) => {
    return (
      ['applied', 'screening'].includes(a.status) &&
      new Date(a.updated_at) < oneWeekAgo
    );
  });
  if (staleApps.length > 0) {
    const oldest = staleApps.reduce((oldest, a) =>
      new Date(a.updated_at) < new Date(oldest.updated_at) ? a : oldest
    );
    const daysSince = Math.floor(
      (now.getTime() - new Date(oldest.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    insights.push({
      type: 'recommendation',
      title: `${staleApps.length} application${staleApps.length > 1 ? 's' : ''} need follow-up`,
      description: `${staleApps.length} application${staleApps.length > 1 ? 's are' : ' is'} sitting without updates — the oldest is ${daysSince} days old.`,
      metric: `${staleApps.length} stale`,
      priority: 1,
      actionable: true,
      suggestedAction: `Draft a follow-up email for my ${oldest.company ?? 'stale'} application`,
    });
  }

  // ─── 5. Success patterns ──────────────────────────────────────────────────
  const successfulApps = applications.filter((a) =>
    ['interview', 'offer'].includes(a.status)
  );
  const rejectedApps = applications.filter((a) => a.status === 'rejected');
  if (successfulApps.length >= 2 && rejectedApps.length >= 2) {
    insights.push({
      type: 'pattern',
      title: `${successfulApps.length} applications progressed to interview/offer`,
      description: `You've had success at ${successfulApps.length} companies. Look at what these applications have in common to replicate that approach.`,
      metric: `${successfulApps.length} successful`,
      priority: 5,
      actionable: true,
      suggestedAction: 'What do my most successful applications have in common?',
    });
  }

  // ─── 6. Milestone celebrations ────────────────────────────────────────────
  const totalSubmitted = applications.filter((a) => a.status !== 'saved').length;
  const firstInterview = applications.some((a) => a.status === 'interview');
  const firstOffer = applications.some((a) => a.status === 'offer');

  if (totalSubmitted === 1) {
    insights.push({
      type: 'milestone',
      title: 'First application submitted!',
      description: "You've taken the first step — the hardest part is getting started. Keep going!",
      priority: 2,
      actionable: false,
    });
  } else if (totalSubmitted === 10) {
    insights.push({
      type: 'milestone',
      title: '10 applications submitted',
      description: "Double digits! You're building a strong pipeline. Keep the momentum going.",
      metric: '10 apps',
      priority: 4,
      actionable: false,
    });
  } else if (totalSubmitted === 25) {
    insights.push({
      type: 'milestone',
      title: '25 applications — strong pipeline',
      description: "You've submitted 25 applications. That's serious momentum. How are the responses looking?",
      metric: '25 apps',
      priority: 4,
      actionable: true,
      suggestedAction: 'How is my application response rate looking?',
    });
  }

  if (firstInterview && !firstOffer && applications.filter((a) => a.status === 'interview').length === 1) {
    insights.push({
      type: 'milestone',
      title: 'First interview!',
      description: "You've landed your first interview — that's a real signal your applications are working. Let's make sure you're prepared.",
      priority: 1,
      actionable: true,
      suggestedAction: `Help me prepare for my interview at ${applications.find((a) => a.status === 'interview')?.company ?? 'my upcoming company'}`,
    });
  }

  if (firstOffer) {
    insights.push({
      type: 'milestone',
      title: 'Offer received!',
      description: "You have an offer — congratulations! Let's make sure you make the best decision.",
      priority: 1,
      actionable: true,
      suggestedAction: 'Help me evaluate my job offer',
    });
  }

  // ─── 7. Weekly momentum ───────────────────────────────────────────────────
  const thisWeek = applications.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= oneWeekAgo
  ).length;

  if (thisWeek > 0) {
    const avgWeekly = totalSubmitted > 0 ? totalSubmitted / 4 : 0; // rough 4-week avg
    const comparison =
      thisWeek > avgWeekly * 1.3
        ? 'above your average'
        : thisWeek < avgWeekly * 0.7
          ? 'below your average'
          : 'on par with your average';

    insights.push({
      type: 'trend',
      title: `${thisWeek} application${thisWeek > 1 ? 's' : ''} this week`,
      description: `You've submitted ${thisWeek} application${thisWeek > 1 ? 's' : ''} this week — ${comparison}. ${thisWeek > avgWeekly ? 'Great work!' : 'Keep pushing!'}`,
      metric: `${thisWeek} this week`,
      priority: 5,
      actionable: thisWeek < avgWeekly * 0.7,
      suggestedAction:
        thisWeek < avgWeekly * 0.7
          ? 'Search for jobs matching my profile and preferences'
          : undefined,
    });
  }

  // Sort by priority (1 = highest) and return max 5
  return insights.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
