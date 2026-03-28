"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { ApplicationStatusResult, ApplicationSummary } from "@/lib/chat/types";

interface Props {
  data: ApplicationStatusResult;
  onAppend?: (content: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  saved: { label: "Saved", color: "bg-zinc-200 text-zinc-700" },
  applied: { label: "Applied", color: "bg-blue-100 text-blue-700" },
  screening: { label: "Screening", color: "bg-yellow-100 text-yellow-700" },
  interview: { label: "Interview", color: "bg-purple-100 text-purple-700" },
  offer: { label: "Offer", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  withdrawn: { label: "Withdrawn", color: "bg-zinc-100 text-zinc-500" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "bg-zinc-100 text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AppCard({ app }: { app: ApplicationSummary }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{app.company}</p>
        <p className="text-xs text-muted-foreground truncate">{app.role}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={app.status} />
        <span className="text-xs text-muted-foreground">
          {app.daysSinceUpdate === 0 ? "Today" : `${app.daysSinceUpdate}d ago`}
        </span>
        <Link href={`/dashboard/applications`}>
          <ArrowRight className="h-3 w-3 text-muted-foreground hover:text-foreground" />
        </Link>
      </div>
    </div>
  );
}

export function ApplicationStatusCards({ data, onAppend }: Props) {
  const { applications, counts } = data;
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  const active = (counts.applied ?? 0) + (counts.screening ?? 0) + (counts.interview ?? 0);

  const summaryStatuses = (["applied", "screening", "interview", "offer"] as const).filter(
    (s) => counts[s] > 0
  );

  if (total === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No applications tracked yet.</p>
          <Button size="sm" onClick={() => onAppend?.("Search for jobs matching my profile")}>
            Find jobs to apply to
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Application Pipeline</CardTitle>
        <div className="flex flex-wrap gap-2 mt-1">
          {summaryStatuses.map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {STATUS_CONFIG[s]?.label}: {counts[s]}
            </Badge>
          ))}
          {active > 0 && (
            <Badge variant="outline" className="text-xs">
              {active} active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {applications.length === 0 ? (
          <p className="text-xs text-muted-foreground">No applications in this filter.</p>
        ) : (
          <div>
            {applications.map((app) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/applications">View full board →</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
