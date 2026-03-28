"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationBoardData, ApplicationForBoard } from "@/lib/chat/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  saved: { label: "Saved", color: "bg-slate-50 border-slate-200", dot: "bg-slate-400" },
  applied: { label: "Applied", color: "bg-blue-50 border-blue-200", dot: "bg-blue-500" },
  screening: { label: "Screening", color: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500" },
  interview: { label: "Interview", color: "bg-purple-50 border-purple-200", dot: "bg-purple-500" },
  offer: { label: "Offer", color: "bg-green-50 border-green-200", dot: "bg-green-500" },
  rejected: { label: "Rejected", color: "bg-red-50 border-red-200", dot: "bg-red-400" },
};

const STATUS_ORDER = ["applied", "screening", "interview", "offer", "saved", "rejected"];

interface Props {
  data: ApplicationBoardData;
  onAppend?: (content: string) => void;
}

function AppCard({ app, onAppend }: { app: ApplicationForBoard; onAppend?: (s: string) => void }) {
  return (
    <button
      className="w-full text-left rounded-md border bg-background px-2.5 py-2 hover:bg-muted/50 transition-colors"
      onClick={() =>
        onAppend?.(`Tell me about my ${app.company} - ${app.role} application`)
      }
    >
      <p className="text-xs font-semibold truncate">{app.company}</p>
      <p className="text-[11px] text-muted-foreground truncate">{app.role}</p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
        {app.daysSinceUpdate === 0 ? "Updated today" : `${app.daysSinceUpdate}d ago`}
      </p>
    </button>
  );
}

export function ApplicationBoardInline({ data, onAppend }: Props) {
  const activeStatuses = STATUS_ORDER.filter(
    (s) => data.groupedCounts[s] !== undefined && data.groupedCounts[s] > 0
  );

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <p className="text-sm font-semibold">Application Pipeline</p>
          <p className="text-xs text-muted-foreground">{data.totalCount} total applications</p>
        </div>
        <Link
          href="/dashboard/applications"
          className="flex items-center gap-1 text-xs text-[oklch(0.44_0.19_265)] hover:underline"
        >
          Full board
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-3 p-3 min-w-max">
          {activeStatuses.map((status) => {
            const config = STATUS_CONFIG[status] ?? {
              label: status,
              color: "bg-muted border-border",
              dot: "bg-muted-foreground",
            };
            const appsInStatus = data.applications
              .filter((a) => a.status === status)
              .slice(0, 3);

            return (
              <div
                key={status}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border p-2 min-w-[160px] max-w-[160px]",
                  config.color
                )}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full shrink-0", config.dot)} />
                    <span className="text-xs font-semibold">{config.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {data.groupedCounts[status]}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-1.5">
                  {appsInStatus.map((app) => (
                    <AppCard key={app.id} app={app} onAppend={onAppend} />
                  ))}
                  {(data.groupedCounts[status] ?? 0) > 3 && (
                    <p className="text-[10px] text-center text-muted-foreground py-0.5">
                      +{(data.groupedCounts[status] ?? 0) - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {activeStatuses.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 px-2">No applications yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
