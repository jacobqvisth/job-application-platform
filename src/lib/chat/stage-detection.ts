export type JobSearchStage =
  | 'exploring'         // mostly saving jobs, few applications
  | 'actively_applying' // submitting applications regularly
  | 'interviewing'      // has interview-stage applications
  | 'negotiating'       // has offer-stage applications
  | 'stalled';          // low activity for 14+ days

export interface StageContext {
  stage: JobSearchStage;
  confidence: number;         // 0-1, how confident the detection is
  reason: string;             // human-readable explanation
  daysSinceLastActivity: number;
  activeInterviews: number;
  activeOffers: number;
  weeklyApplicationRate: number; // apps per week over last 4 weeks
  totalApplications: number;
}

interface ApplicationRow {
  id: string;
  status: string;
  updated_at: string;
  applied_at?: string | null;
}

export function detectJobSearchStage(applications: ApplicationRow[]): StageContext {
  const now = new Date();
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const totalApplications = applications.length;

  // Confidence: more data = higher confidence
  const confidence =
    totalApplications < 5 ? 0.4 : totalApplications < 15 ? 0.7 : 0.9;

  // Count active interviews and offers
  const activeInterviews = applications.filter((a) => a.status === 'interview').length;
  const activeOffers = applications.filter((a) => a.status === 'offer').length;

  // Weekly application rate over last 4 weeks
  const recentApps = applications.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= fourWeeksAgo
  );
  const weeklyApplicationRate = recentApps.length / 4;

  // Days since last activity (non-saved apps only)
  const nonSavedApps = applications.filter((a) => a.status !== 'saved');
  let daysSinceLastActivity = 0;
  if (nonSavedApps.length > 0) {
    const mostRecent = nonSavedApps.reduce((latest, app) => {
      const appDate = new Date(app.updated_at);
      const appliedDate = app.applied_at ? new Date(app.applied_at) : null;
      const mostRecentDate = appliedDate && appliedDate > appDate ? appliedDate : appDate;
      return mostRecentDate > latest ? mostRecentDate : latest;
    }, new Date(0));
    daysSinceLastActivity = Math.floor(
      (now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  // Priority order: first match wins

  // 1. negotiating
  if (activeOffers > 0) {
    return {
      stage: 'negotiating',
      confidence,
      reason: `${activeOffers} offer${activeOffers > 1 ? 's' : ''} on the table`,
      daysSinceLastActivity,
      activeInterviews,
      activeOffers,
      weeklyApplicationRate,
      totalApplications,
    };
  }

  // 2. interviewing
  if (activeInterviews > 0) {
    return {
      stage: 'interviewing',
      confidence,
      reason: `${activeInterviews} active interview${activeInterviews > 1 ? 's' : ''}`,
      daysSinceLastActivity,
      activeInterviews,
      activeOffers,
      weeklyApplicationRate,
      totalApplications,
    };
  }

  // 3. stalled
  if (nonSavedApps.length > 0 && daysSinceLastActivity >= 14) {
    return {
      stage: 'stalled',
      confidence,
      reason: `No activity in ${daysSinceLastActivity} days`,
      daysSinceLastActivity,
      activeInterviews,
      activeOffers,
      weeklyApplicationRate,
      totalApplications,
    };
  }

  // 4. actively_applying
  const appliedLast14Days = applications.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= twoWeeksAgo
  ).length;
  if (appliedLast14Days >= 2) {
    return {
      stage: 'actively_applying',
      confidence,
      reason: `${appliedLast14Days} applications in the last 2 weeks`,
      daysSinceLastActivity,
      activeInterviews,
      activeOffers,
      weeklyApplicationRate,
      totalApplications,
    };
  }

  // 5. exploring (default)
  return {
    stage: 'exploring',
    confidence,
    reason:
      totalApplications === 0
        ? 'No applications submitted yet'
        : 'Browsing and saving, not yet applying regularly',
    daysSinceLastActivity,
    activeInterviews,
    activeOffers,
    weeklyApplicationRate,
    totalApplications,
  };
}
