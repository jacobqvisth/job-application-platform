"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { markApplicationRejectedAction } from "@/app/(protected)/dashboard/review/actions";
import type { Application, ApplicationStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface AttentionSectionProps {
  followUpQueue: Application[];
  staleApplications: Application[];
}

function msSinceDate(dateStr: string | null): number {
  if (!dateStr) return 0;
  return Date.now() - new Date(dateStr).getTime();
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "unknown";
  const diffMs = msSinceDate(dateStr);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 0) {
    const future = Math.abs(diffDays);
    return `in ${future} day${future !== 1 ? "s" : ""}`;
  }
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
}

function daysElapsed(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor(msSinceDate(dateStr) / (1000 * 60 * 60 * 24));
}

function daysSince(dateStr: string | null): string {
  return relativeTime(dateStr);
}

function FollowUpRow({ app }: { app: Application }) {
  const appliedDays = daysElapsed(app.applied_at);

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{app.company}</span>
          <StatusBadge status={app.status as ApplicationStatus} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.role}</p>
        <p className="text-xs text-muted-foreground">
          {appliedDays !== null ? `Applied ${appliedDays}d ago` : ""}
          {app.next_followup_at
            ? ` · Follow-up due ${daysSince(app.next_followup_at)}`
            : ""}
        </p>
      </div>
      <Link
        href={`/dashboard/draft?company=${encodeURIComponent(app.company)}&role=${encodeURIComponent(app.role)}`}
        className="shrink-0"
      >
        <Button variant="outline" size="sm" className="text-xs whitespace-nowrap">
          Draft Follow-Up
        </Button>
      </Link>
    </div>
  );
}

function StaleRow({ app }: { app: Application }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleMarkRejected() {
    startTransition(async () => {
      await markApplicationRejectedAction(app.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{app.company}</span>
          <StatusBadge status={app.status as ApplicationStatus} />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{app.role}</p>
        <p className="text-xs text-muted-foreground">
          Last updated {daysSince(app.updated_at)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950"
        onClick={handleMarkRejected}
        disabled={isPending}
      >
        {isPending ? "Marking…" : "Mark as Rejected"}
      </Button>
    </div>
  );
}

export function AttentionSection({
  followUpQueue,
  staleApplications,
}: AttentionSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const total = followUpQueue.length + staleApplications.length;

  return (
    <div>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 mb-4 group w-full text-left"
      >
        <h2 className="text-base font-semibold">Needs Attention</h2>
        {total > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-xs font-semibold px-2 py-0.5">
            {total}
          </span>
        )}
        <span className="ml-auto text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>

      <div className={cn("space-y-4", !isOpen && "hidden")}>
        {/* Follow-Up Queue */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/20">
            <h3 className="text-sm font-semibold">
              Follow-Up Queue{" "}
              <span className="text-muted-foreground font-normal">
                ({followUpQueue.length})
              </span>
            </h3>
          </div>
          <div className="px-5">
            {followUpQueue.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All caught up — no follow-ups due
              </p>
            ) : (
              followUpQueue.map((app) => <FollowUpRow key={app.id} app={app} />)
            )}
          </div>
        </div>

        {/* Stale Applications */}
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-muted/20">
            <h3 className="text-sm font-semibold">
              Stale Applications{" "}
              <span className="text-muted-foreground font-normal">
                ({staleApplications.length})
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              No updates in 14+ days
            </p>
          </div>
          <div className="px-5">
            {staleApplications.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No stale applications
              </p>
            ) : (
              staleApplications.map((app) => (
                <StaleRow key={app.id} app={app} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
