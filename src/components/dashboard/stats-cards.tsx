import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApplicationStats } from "@/lib/types/database";
import { Briefcase, TrendingUp, BarChart3, Calendar } from "lucide-react";

interface StatsCardsProps {
  stats: ApplicationStats;
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
          <div className="text-2xl font-bold">{stats.total}</div>
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
          <div className="text-2xl font-bold">{stats.thisWeek}</div>
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
          <div className="text-2xl font-bold">
            {stats.responseRate !== null ? `${stats.responseRate}%` : "--"}
          </div>
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
          <div className="text-2xl font-bold">
            {stats.byStatus.interview + stats.byStatus.offer}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
