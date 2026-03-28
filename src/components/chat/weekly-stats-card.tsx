"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { WeeklyStatsResult } from "@/lib/chat/types";

interface Props {
  data: WeeklyStatsResult;
}

function StatItem({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground leading-tight">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function WeeklyStatsCard({ data }: Props) {
  const { stats, insight } = data;
  const periodLabel = stats.period === 'month' ? 'This Month' : 'This Week';

  const rateIcon =
    stats.responseRate !== null && stats.responseRate >= 20 ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : stats.responseRate !== null && stats.responseRate < 10 ? (
      <TrendingDown className="h-4 w-4 text-red-500" />
    ) : (
      <Minus className="h-4 w-4 text-muted-foreground" />
    );

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{periodLabel} Stats</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatItem
            label="Applied"
            value={stats.appsSubmitted}
          />
          <StatItem
            label="Responses"
            value={stats.responsesReceived}
          />
          <StatItem
            label="Interviews"
            value={stats.interviewInvitations}
          />
          <StatItem
            label="Response rate"
            value={stats.responseRate !== null ? `${stats.responseRate}%` : "—"}
            sub={stats.responseRate !== null ? "" : "No data"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatItem
            label="Active applications"
            value={stats.activeApplications}
          />
          <StatItem
            label="Stale (2+ weeks)"
            value={stats.staleApplications}
          />
        </div>

        {insight && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
            {rateIcon}
            <p className="text-xs text-muted-foreground">{insight}</p>
          </div>
        )}

        <div className="flex gap-2 pt-1 border-t">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/review">Full review →</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/applications">View pipeline →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
