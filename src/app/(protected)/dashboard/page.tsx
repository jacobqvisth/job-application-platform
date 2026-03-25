import { createClient } from "@/lib/supabase/server";
import { getApplicationStats, getRecentEvents } from "@/lib/data/applications";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [stats, recentEvents] = await Promise.all([
    getApplicationStats(supabase),
    getRecentEvents(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.user_metadata?.full_name || user?.email}
          </p>
        </div>
        <DashboardActions />
      </div>

      <StatsCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentActivity events={recentEvents} />

        <div className="space-y-4">
          <h3 className="text-base font-semibold">Status Breakdown</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="text-sm capitalize text-muted-foreground">
                  {status}
                </span>
                <span className="text-sm font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
