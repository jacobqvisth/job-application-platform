import { createClient } from "@/lib/supabase/server";
import type { Application, ApplicationStatus } from "@/lib/types/database";

interface AppWithEvents extends Application {
  application_events: Array<{
    id: string;
    event_type: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
}

export interface WeeklyReviewData {
  /** ISO strings for the 7-day window */
  period: { start: string; end: string };

  // Activity this week
  appliedThisWeek: Application[];
  movedForwardThisWeek: Application[];
  rejectedThisWeek: Application[];

  // Pipeline snapshot
  activeApplications: Application[];
  staleApplications: Application[];
  followUpQueue: Application[];

  // Analytics
  totalApplied: number;
  responseRate: number | null;
  conversionByStage: {
    appliedToScreening: number | null;
    screeningToInterview: number | null;
    interviewToOffer: number | null;
  };
  avgDaysToResponse: number | null;
  topPerformingFilters: {
    byLocation: Array<{ location: string; responseRate: number; count: number }>;
    byRemoteType: Array<{ remoteType: string; responseRate: number; count: number }>;
  };

  // Answer library health
  answerLibraryStats: {
    totalQuestions: number;
    strongAnswers: number;
    needsWorkAnswers: number;
  };

  // Stage counts (for funnel)
  byStatus: Record<ApplicationStatus, number>;
}

export async function getWeeklyReviewData(userId: string): Promise<WeeklyReviewData> {
  const supabase = await createClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Single query: all applications + events
  const { data: rawApps, error } = await supabase
    .from("applications")
    .select("*, application_events(id, event_type, metadata, created_at)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const apps = (rawApps ?? []) as AppWithEvents[];

  // Strip events for clean Application[] return
  function strip(app: AppWithEvents): Application {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { application_events: _events, ...rest } = app;
    return rest as Application;
  }

  const FORWARD_STATUSES = new Set(["screening", "interview", "offer"]);
  const REJECTED_STATUSES = new Set(["rejected", "withdrawn"]);

  // --- Activity this week ---
  const appliedThisWeek = apps
    .filter((a) => a.applied_at && new Date(a.applied_at) >= sevenDaysAgo)
    .map(strip);

  const movedForwardThisWeek = apps
    .filter((a) =>
      a.application_events.some(
        (e) =>
          e.event_type === "status_change" &&
          new Date(e.created_at) >= sevenDaysAgo &&
          FORWARD_STATUSES.has(String(e.metadata?.new_status ?? ""))
      )
    )
    .map(strip);

  const rejectedThisWeek = apps
    .filter((a) =>
      a.application_events.some(
        (e) =>
          e.event_type === "status_change" &&
          new Date(e.created_at) >= sevenDaysAgo &&
          REJECTED_STATUSES.has(String(e.metadata?.new_status ?? ""))
      )
    )
    .map(strip);

  // --- Pipeline snapshot ---
  const activeApplications = apps
    .filter((a) => !["rejected", "withdrawn", "saved"].includes(a.status))
    .map(strip);

  const staleApplications = apps
    .filter(
      (a) =>
        ["applied", "screening"].includes(a.status) &&
        new Date(a.updated_at) < fourteenDaysAgo
    )
    .map(strip);

  const followUpQueue = apps
    .filter((a) => {
      if (a.next_followup_at && new Date(a.next_followup_at) <= now) return true;
      if (
        a.status === "applied" &&
        a.applied_at &&
        new Date(a.applied_at) < tenDaysAgo &&
        !a.next_followup_at
      )
        return true;
      return false;
    })
    .map(strip);

  // --- byStatus counts ---
  const byStatus: Record<ApplicationStatus, number> = {
    saved: 0,
    applied: 0,
    screening: 0,
    interview: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  };
  for (const a of apps) {
    byStatus[a.status as ApplicationStatus]++;
  }

  // --- Analytics ---
  const totalApplied = apps.filter((a) => a.status !== "saved").length;

  const appliedCount = totalApplied;
  const respondedCount = apps.filter((a) =>
    FORWARD_STATUSES.has(a.status)
  ).length;
  const responseRate =
    appliedCount > 0 ? Math.round((respondedCount / appliedCount) * 100) : null;

  // Funnel: count apps that ever reached each stage (using events for accuracy)
  const passedScreening = new Set<string>();
  const passedInterview = new Set<string>();
  const passedOffer = new Set<string>();

  for (const a of apps) {
    if (a.status === "saved") continue;

    if (FORWARD_STATUSES.has(a.status)) passedScreening.add(a.id);
    if (["interview", "offer"].includes(a.status)) passedInterview.add(a.id);
    if (a.status === "offer") passedOffer.add(a.id);

    for (const e of a.application_events) {
      if (e.event_type !== "status_change") continue;
      const ns = String(e.metadata?.new_status ?? "");
      if (FORWARD_STATUSES.has(ns)) passedScreening.add(a.id);
      if (["interview", "offer"].includes(ns)) passedInterview.add(a.id);
      if (ns === "offer") passedOffer.add(a.id);
    }
  }

  const conversionByStage = {
    appliedToScreening:
      totalApplied > 0
        ? Math.round((passedScreening.size / totalApplied) * 100)
        : null,
    screeningToInterview:
      passedScreening.size > 0
        ? Math.round((passedInterview.size / passedScreening.size) * 100)
        : null,
    interviewToOffer:
      passedInterview.size > 0
        ? Math.round((passedOffer.size / passedInterview.size) * 100)
        : null,
  };

  // avgDaysToResponse
  const responseTimes: number[] = [];
  for (const a of apps) {
    if (!a.applied_at) continue;
    const firstForward = a.application_events
      .filter(
        (e) =>
          e.event_type === "status_change" &&
          FORWARD_STATUSES.has(String(e.metadata?.new_status ?? ""))
      )
      .sort(
        (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime()
      )[0];
    if (firstForward) {
      const days =
        (new Date(firstForward.created_at).getTime() - new Date(a.applied_at).getTime()) /
        (1000 * 60 * 60 * 24);
      if (days >= 0) responseTimes.push(days);
    }
  }
  const avgDaysToResponse =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length)
      : null;

  // topPerformingFilters
  const locationMap = new Map<string, { responded: number; total: number }>();
  const remoteMap = new Map<string, { responded: number; total: number }>();

  for (const a of apps) {
    if (a.status === "saved") continue;
    const responded = FORWARD_STATUSES.has(a.status);

    if (a.location) {
      const entry = locationMap.get(a.location) ?? { responded: 0, total: 0 };
      entry.total++;
      if (responded) entry.responded++;
      locationMap.set(a.location, entry);
    }

    const rk = a.remote_type ?? "unknown";
    const rem = remoteMap.get(rk) ?? { responded: 0, total: 0 };
    rem.total++;
    if (responded) rem.responded++;
    remoteMap.set(rk, rem);
  }

  const byLocation = [...locationMap.entries()]
    .filter(([, v]) => v.total >= 3)
    .map(([location, v]) => ({
      location,
      responseRate: Math.round((v.responded / v.total) * 100),
      count: v.total,
    }))
    .sort((a, b) => b.responseRate - a.responseRate)
    .slice(0, 5);

  const byRemoteType = [...remoteMap.entries()]
    .filter(([, v]) => v.total >= 3)
    .map(([remoteType, v]) => ({
      remoteType,
      responseRate: Math.round((v.responded / v.total) * 100),
      count: v.total,
    }))
    .sort((a, b) => b.responseRate - a.responseRate)
    .slice(0, 5);

  // Answer library stats (separate queries are fine per spec)
  const [questionsRes, answersRes] = await Promise.all([
    supabase
      .from("canonical_questions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase.from("screening_answers").select("rating").eq("user_id", userId),
  ]);

  const totalQuestions = questionsRes.count ?? 0;
  const answerRows = answersRes.data ?? [];
  const strongAnswers = answerRows.filter((r) => r.rating === "strong").length;
  const needsWorkAnswers = answerRows.filter((r) => r.rating === "needs_work").length;

  return {
    period: {
      start: sevenDaysAgo.toISOString(),
      end: now.toISOString(),
    },
    appliedThisWeek,
    movedForwardThisWeek,
    rejectedThisWeek,
    activeApplications,
    staleApplications,
    followUpQueue,
    totalApplied,
    responseRate,
    conversionByStage,
    avgDaysToResponse,
    topPerformingFilters: { byLocation, byRemoteType },
    answerLibraryStats: { totalQuestions, strongAnswers, needsWorkAnswers },
    byStatus,
  };
}
