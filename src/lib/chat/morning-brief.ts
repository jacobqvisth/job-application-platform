import { createClient } from "@/lib/supabase/server";

export interface MorningBriefData {
  userName: string | null;
  changedSince: Array<{ company: string; role: string; newStatus: string }>;
  staleApplications: Array<{ company: string; role: string; daysSinceUpdate: number }>;
  interviewsUpcoming: Array<{ company: string; role: string }>;
  weekStats: { applied: number; responses: number; responseRate: number | null };
  suggestedActions: Array<{ label: string; message: string }>;
}

export async function getMorningBriefData(): Promise<MorningBriefData | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [appsRes, eventsRes] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company, role, status, updated_at, applied_at")
      .eq("user_id", user.id),
    supabase
      .from("application_events")
      .select("application_id, event_type, metadata, created_at")
      .gte("created_at", dayAgo.toISOString())
      .order("created_at", { ascending: false }),
  ]);

  const apps = appsRes.data ?? [];
  const userAppIds = new Set(apps.map((a) => a.id));
  const recentEvents = (eventsRes.data ?? []).filter((e) => userAppIds.has(e.application_id));

  const userName = user.user_metadata?.full_name ?? null;

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

  // Contextual suggested actions
  const suggestedActions: Array<{ label: string; message: string }> = [];
  if (interviewsUpcoming.length > 0) {
    const interview = interviewsUpcoming[0];
    suggestedActions.push({
      label: `Prep for ${interview.company}`,
      message: `Help me prepare for my interview at ${interview.company} for ${interview.role}`,
    });
  }
  if (staleApplications.length > 0) {
    suggestedActions.push({
      label: `Follow up ${staleApplications[0].company}`,
      message: `How should I follow up on my ${staleApplications[0].company} application for ${staleApplications[0].role}?`,
    });
  }
  suggestedActions.push({
    label: "Review new matches",
    message: "Search for jobs matching my profile and preferences",
  });

  return {
    userName,
    changedSince,
    staleApplications,
    interviewsUpcoming,
    weekStats: { applied: appliedThisWeek, responses: responsesThisWeek, responseRate },
    suggestedActions: suggestedActions.slice(0, 3),
  };
}
