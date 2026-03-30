import { createClient } from "@/lib/supabase/server";
import { detectJobSearchStage, type JobSearchStage } from "./stage-detection";
import { detectPatterns, type SearchInsight } from "./pattern-detection";

export interface MorningBriefData {
  userName: string | null;
  changedSince: Array<{ company: string; role: string; newStatus: string }>;
  staleApplications: Array<{ company: string; role: string; daysSinceUpdate: number }>;
  interviewsUpcoming: Array<{ company: string; role: string }>;
  weekStats: { applied: number; responses: number; responseRate: number | null };
  suggestedActions: Array<{ label: string; message: string }>;
  stage: JobSearchStage;
  stageMessage: string;
  insights: SearchInsight[];
  newLeadsCount: number;
  newLeadsSources: string[];
}

const STAGE_MESSAGES: Record<JobSearchStage, string> = {
  exploring: "You're exploring opportunities. Here's what's new in your search.",
  actively_applying: "You're in an active application cycle — keep the momentum going.",
  interviewing: "You have interviews in progress. Let's make sure you're prepared.",
  negotiating: "Exciting — you have offers on the table. Let's make the best decision.",
  stalled: "It's been a while since your last activity. Let's get things moving again.",
};

export async function getMorningBriefData(): Promise<MorningBriefData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [appsRes, eventsRes, newLeadsCountRes, newLeadSourceRowsRes] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role, status, updated_at, applied_at")
      .eq("user_id", user.id),
    supabase
      .from("application_events")
      .select("application_id, event_type, metadata, created_at")
      .gte("created_at", dayAgo.toISOString())
      .order("created_at", { ascending: false }),
    supabase
      .from("job_listings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("has_applied", false)
      .gte("created_at", oneDayAgo.toISOString()),
    supabase
      .from("job_listings")
      .select("source")
      .eq("user_id", user.id)
      .eq("has_applied", false)
      .gte("created_at", oneDayAgo.toISOString()),
  ]);

  const apps = appsRes.data ?? [];
  const userAppIds = new Set(apps.map((a) => a.id));
  const recentEvents = (eventsRes.data ?? []).filter((e) => userAppIds.has(e.application_id));
  const newLeadsCount = newLeadsCountRes.count ?? 0;
  const newLeadsSources = [...new Set((newLeadSourceRowsRes.data ?? []).map((r) => r.source))];

  const userName = user.user_metadata?.full_name ?? null;

  // Detect stage and top insights
  const stageContext = detectJobSearchStage(apps);
  const insights = detectPatterns(apps, []).slice(0, 2);

  // Apps that changed status in last 24h
  const appMap = new Map(apps.map((a) => [a.id, a]));
  const changedSince = recentEvents
    .filter((e) => e.event_type === "status_change")
    .slice(0, 3)
    .map((e) => {
      const app = appMap.get(e.application_id);
      const metadata = (e.metadata as Record<string, string> | null) ?? {};
      return {
        company: app?.company ?? "Unknown",
        role: app?.role ?? "Unknown",
        newStatus: metadata.new_status ?? "updated",
      };
    });

  // Stale applications (7+ days no update)
  const staleApplications = apps
    .filter(
      (a) =>
        ["applied", "screening"].includes(a.status) && new Date(a.updated_at) < weekAgo
    )
    .slice(0, 3)
    .map((a) => ({
      company: a.company,
      role: a.role,
      daysSinceUpdate: Math.floor(
        (now.getTime() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));

  // Interviews upcoming
  const interviewsUpcoming = apps
    .filter((a) => a.status === "interview")
    .slice(0, 2)
    .map((a) => ({ company: a.company, role: a.role }));

  // Weekly stats
  const appliedThisWeek = apps.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= weekAgo
  ).length;
  const responsesThisWeek = apps.filter(
    (a) =>
      ["screening", "interview", "offer"].includes(a.status) &&
      new Date(a.updated_at) >= weekAgo
  ).length;
  const totalApplied = apps.filter((a) => a.status !== "saved").length;
  const totalResponded = apps.filter((a) =>
    ["screening", "interview", "offer"].includes(a.status)
  ).length;
  const responseRate =
    totalApplied > 0 ? Math.round((totalResponded / totalApplied) * 100) : null;

  // Contextual suggested actions — stalled stage leads with "Find new jobs"
  const suggestedActions: Array<{ label: string; message: string }> = [];

  if (newLeadsCount > 0) {
    suggestedActions.push({
      label: `Review ${newLeadsCount} new leads`,
      message: `Show me my ${newLeadsCount} new job leads`,
    });
  }

  if (stageContext.stage === "stalled") {
    suggestedActions.push({
      label: "Find new jobs",
      message: "Search for jobs matching my profile and preferences",
    });
    if (staleApplications.length > 0) {
      suggestedActions.push({
        label: `Follow up on ${staleApplications[0].company}`,
        message: `Draft a follow-up email for my ${staleApplications[0].company} application`,
      });
    }
    suggestedActions.push({
      label: "Review my search insights",
      message: "How's my job search going? What patterns do you notice?",
    });
  } else {
    if (interviewsUpcoming.length > 0) {
      const interview = interviewsUpcoming[0];
      suggestedActions.push({
        label: `Prep for ${interview.company}`,
        message: `Help me prepare for my interview at ${interview.company} for ${interview.role}`,
      });
    }
    if (staleApplications.length > 0) {
      suggestedActions.push({
        label: `Follow up on ${staleApplications[0].company}`,
        message: `Draft a follow-up email for my ${staleApplications[0].company} application`,
      });
    }
    suggestedActions.push({
      label: "Find new jobs",
      message: "Search for jobs matching my profile and preferences",
    });
  }

  return {
    userName,
    changedSince,
    staleApplications,
    interviewsUpcoming,
    weekStats: { applied: appliedThisWeek, responses: responsesThisWeek, responseRate },
    suggestedActions: suggestedActions.slice(0, 3),
    stage: stageContext.stage,
    stageMessage: STAGE_MESSAGES[stageContext.stage],
    insights,
    newLeadsCount,
    newLeadsSources,
  };
}
