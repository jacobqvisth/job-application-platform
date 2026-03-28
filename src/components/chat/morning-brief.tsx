"use client";

import { Sparkles, TrendingUp, AlertCircle, BarChart3 } from "lucide-react";
import type { MorningBriefData } from "@/lib/chat/morning-brief";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    screening: "Screening",
    interview: "Interview",
    offer: "Offer",
    rejected: "Rejected",
    applied: "Applied",
    saved: "Saved",
  };
  return labels[status] ?? status;
}

interface Props {
  data: MorningBriefData;
  onSelect: (message: string) => void;
}

export function MorningBrief({ data, onSelect }: Props) {
  const greeting = getGreeting();
  const nameText = data.userName ? `, ${data.userName.split(" ")[0]}` : "";
  const hasActivity =
    data.changedSince.length > 0 ||
    data.staleApplications.length > 0 ||
    data.interviewsUpcoming.length > 0;

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] mx-auto flex items-center justify-center shadow-md">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight" suppressHydrationWarning>
          {greeting}{nameText}.
        </h2>
        <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s new since you were last here.</p>
      </div>

      <div className="w-full space-y-3">
        {/* Since you were last here */}
        {data.changedSince.length > 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              <TrendingUp className="h-3 w-3" />
              Updates
            </div>
            <ul className="space-y-1">
              {data.changedSince.map((item, i) => (
                <li key={i} className="text-xs text-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>
                    <span className="font-medium">{item.company}</span> moved to{" "}
                    <span className="font-medium">{statusLabel(item.newStatus)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Needs attention */}
        {(data.staleApplications.length > 0 || data.interviewsUpcoming.length > 0) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
              <AlertCircle className="h-3 w-3" />
              Needs Attention
            </div>
            <ul className="space-y-1">
              {data.staleApplications.map((app, i) => (
                <li key={`stale-${i}`} className="text-xs text-amber-800 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>
                    <span className="font-medium">{app.company}</span> application is{" "}
                    {app.daysSinceUpdate} days old with no response
                  </span>
                </li>
              ))}
              {data.interviewsUpcoming.map((app, i) => (
                <li key={`interview-${i}`} className="text-xs text-amber-800 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span>
                    Interview stage at <span className="font-medium">{app.company}</span> — prep ready?
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* This week stats */}
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            <BarChart3 className="h-3 w-3" />
            This Week
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-center">
              <p className="font-semibold">{data.weekStats.applied}</p>
              <p className="text-[11px] text-muted-foreground">applied</p>
            </div>
            <div className="text-center">
              <p className="font-semibold">{data.weekStats.responses}</p>
              <p className="text-[11px] text-muted-foreground">responses</p>
            </div>
            {data.weekStats.responseRate !== null && (
              <div className="text-center">
                <p className="font-semibold">{data.weekStats.responseRate}%</p>
                <p className="text-[11px] text-muted-foreground">response rate</p>
              </div>
            )}
          </div>
        </div>

        {/* What would you like to tackle? */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium text-center">
            What would you like to tackle?
          </p>
          <div className="flex flex-col gap-2">
            {data.suggestedActions.map((action) => (
              <button
                key={action.label}
                className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(action.message)}
              >
                <span className="text-xs">{action.message}</span>
                <span className="text-xs font-medium text-[oklch(0.44_0.19_265)] shrink-0 ml-2">
                  {action.label} →
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasActivity && (
        <p className="text-sm text-muted-foreground text-center">
          Nothing new since your last visit. What would you like to work on?
        </p>
      )}
    </div>
  );
}
