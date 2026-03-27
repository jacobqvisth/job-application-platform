import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStats } from "@/lib/types/database";
import { Briefcase, TrendingUp, TrendingDown, BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardsProps {
  stats: ApplicationStats;
}

interface TrendBadgeProps {
  value: number;
  label?: string;
}

function TrendBadge({ value, label }: TrendBadgeProps) {
  const isPositive = value >= 0;
  return (
    <div className="flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium",
          isPositive
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
        )}
      >
        {isPositive ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        {isPositive ? "+" : ""}{value.toFixed(1)}%
      </span>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Applications
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100">
            <Briefcase className="h-4 w-4 text-violet-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            This Week
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100">
            <Calendar className="h-4 w-4 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">{stats.thisWeek}</div>
          {stats.thisWeek > 0 && (
            <div className="mt-1">
              <TrendBadge value={100} label="vs last week" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Response Rate
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {stats.responseRate !== null ? `${stats.responseRate}%` : "--"}
          </div>
          {stats.responseRate !== null && (
            <div className="mt-1">
              <TrendBadge value={stats.responseRate} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Interviews
          </CardTitle>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
            <BarChart3 className="h-4 w-4 text-amber-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight">
            {stats.byStatus.interview + stats.byStatus.offer}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
