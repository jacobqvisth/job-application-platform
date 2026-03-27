import type { WeeklyReviewData } from "@/lib/data/review";

interface ActivityStatsProps {
  data: WeeklyReviewData;
}

interface StatCardProps {
  value: string | number;
  label: string;
  sublabel?: string;
}

function StatCard({ value, label, sublabel }: StatCardProps) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{label}</p>
      {sublabel && (
        <p className="mt-0.5 text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

export function ActivityStats({ data }: ActivityStatsProps) {
  const responseDisplay =
    data.responseRate !== null ? `${data.responseRate}%` : "–";

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        value={data.appliedThisWeek.length}
        label="Applied"
        sublabel="New applications this week"
      />
      <StatCard
        value={data.movedForwardThisWeek.length}
        label="Moved Forward"
        sublabel="Reached screening / interview / offer"
      />
      <StatCard
        value={data.rejectedThisWeek.length}
        label="Rejected"
        sublabel="Rejected or withdrawn this week"
      />
      <StatCard
        value={responseDisplay}
        label="Response Rate"
        sublabel="All-time"
      />
    </div>
  );
}
