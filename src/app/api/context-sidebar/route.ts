import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateSuggestions } from "@/lib/chat/suggestions";

export interface PipelineSummary {
  saved: number;
  applied: number;
  screening: number;
  interview: number;
  offer: number;
  rejected: number;
  total: number;
}

export interface RecentActivityItem {
  id: string;
  eventType: string;
  description: string | null;
  createdAt: string;
  relativeTime: string;
  company: string | null;
  role: string | null;
}

export interface SidebarWeeklyStats {
  appliedThisWeek: number;
  responsesThisWeek: number;
  responseRate: number | null;
}

export interface ContextSidebarPayload {
  pipeline: PipelineSummary;
  recentActivity: RecentActivityItem[];
  stats: SidebarWeeklyStats;
  suggestions: Array<{ text: string; action: string; priority: number }>;
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch all user applications
  const { data: apps } = await supabase
    .from("applications")
    .select("id, company, role, status, updated_at, applied_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const allApps = apps ?? [];
  const appIds = allApps.map((a) => a.id);

  // Fetch recent events for this user's applications
  const eventsRes =
    appIds.length > 0
      ? await supabase
          .from("application_events")
          .select("id, event_type, description, created_at, application_id")
          .in("application_id", appIds)
          .order("created_at", { ascending: false })
          .limit(5)
      : { data: [] };

  const events = eventsRes.data ?? [];

  // Pipeline counts
  const statusCounts: Record<string, number> = {
    saved: 0, applied: 0, screening: 0, interview: 0, offer: 0, rejected: 0,
  };
  for (const app of allApps) {
    if (app.status in statusCounts) statusCounts[app.status]++;
  }
  const pipeline: PipelineSummary = {
    saved: statusCounts.saved ?? 0,
    applied: statusCounts.applied ?? 0,
    screening: statusCounts.screening ?? 0,
    interview: statusCounts.interview ?? 0,
    offer: statusCounts.offer ?? 0,
    rejected: statusCounts.rejected ?? 0,
    total: allApps.length,
  };

  // Recent activity with company/role lookup
  const appMap = new Map(allApps.map((a) => [a.id, { company: a.company, role: a.role }]));
  const recentActivity: RecentActivityItem[] = events.map((e) => ({
    id: e.id,
    eventType: e.event_type,
    description: e.description,
    createdAt: e.created_at,
    relativeTime: relativeTime(e.created_at),
    company: appMap.get(e.application_id)?.company ?? null,
    role: appMap.get(e.application_id)?.role ?? null,
  }));

  // Weekly stats
  const appliedThisWeek = allApps.filter(
    (a) => a.applied_at && new Date(a.applied_at) >= weekAgo
  ).length;
  const respondedStatuses = new Set(["screening", "interview", "offer"]);
  const responsesThisWeek = allApps.filter(
    (a) => respondedStatuses.has(a.status) && new Date(a.updated_at) >= weekAgo
  ).length;
  const totalApplied = allApps.filter((a) => a.status !== "saved").length;
  const totalResponded = allApps.filter((a) => respondedStatuses.has(a.status)).length;
  const responseRate =
    totalApplied > 0 ? Math.round((totalResponded / totalApplied) * 100) : null;

  // Generate suggestions
  const appSummaries = allApps.map((a) => ({
    id: a.id,
    company: a.company,
    role: a.role,
    status: a.status,
    daysSinceUpdate: Math.floor(
      (now.getTime() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
  const suggestions = generateSuggestions({
    applications: appSummaries,
    weeklyStats: { appsSubmitted: appliedThisWeek, responseRate },
    savedSearches: [],
  });

  const payload: ContextSidebarPayload = {
    pipeline,
    recentActivity,
    stats: { appliedThisWeek, responsesThisWeek, responseRate },
    suggestions,
  };

  return NextResponse.json(payload);
}
