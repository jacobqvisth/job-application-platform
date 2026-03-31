"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DiscoveredJobsResult } from "@/lib/chat/types";

const SOURCE_STYLES: Record<string, { label: string; className: string }> = {
  platsbanken: { label: "Platsbanken", className: "bg-blue-100 text-blue-700 border-blue-200" },
  jobtechdev: { label: "Platsbanken", className: "bg-blue-100 text-blue-700 border-blue-200" },
  linkedin: { label: "LinkedIn", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  teamtailor: { label: "Teamtailor", className: "bg-violet-100 text-violet-700 border-violet-200" },
  varbi: { label: "Varbi", className: "bg-purple-100 text-purple-700 border-purple-200" },
  jobylon: { label: "Jobylon", className: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200" },
  reachmee: { label: "ReachMee", className: "bg-pink-100 text-pink-700 border-pink-200" },
  adzuna: { label: "Adzuna", className: "bg-orange-100 text-orange-700 border-orange-200" },
  email: { label: "Email", className: "bg-gray-100 text-gray-600 border-gray-200" },
  screenshot: { label: "Screenshot", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  manual: { label: "Manual", className: "bg-zinc-100 text-zinc-600 border-zinc-200" },
};

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_STYLES[source] ?? { label: source, className: "bg-muted text-muted-foreground border-muted" };
  return (
    <Badge variant="outline" className={`text-xs px-1.5 py-0 font-normal ${style.className}`}>
      {style.label}
    </Badge>
  );
}

interface Props {
  data: DiscoveredJobsResult;
}

export function DiscoveredJobsCard({ data }: Props) {
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(
    new Set(data.jobs.filter((j) => j.hasApplied).map((j) => j.id))
  );

  if (data.errorMessage) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {data.errorMessage}
      </div>
    );
  }

  async function handleApply(job: DiscoveredJobsResult["jobs"][0]) {
    setApplyingIds((prev) => new Set(prev).add(job.id));
    try {
      const res = await fetch("/api/jobs/start-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobListingId: job.id }),
      });
      if (!res.ok) throw new Error("Failed");

      window.open(job.url, "_blank", "noopener,noreferrer");
      setAppliedIds((prev) => new Set(prev).add(job.id));
    } catch {
      // silently fail — card is in chat context
    } finally {
      setApplyingIds((prev) => {
        const s = new Set(prev);
        s.delete(job.id);
        return s;
      });
    }
  }

  const sourcesWithCount = Object.entries(data.sourceBreakdown).filter(([, count]) => count > 0);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <span className="text-sm font-semibold">Job Leads</span>
        <div className="flex items-center gap-2">
          {data.newCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 text-xs font-medium">
              {data.newCount} new
            </span>
          )}
          {data.appliedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
              {data.appliedCount} applied
            </span>
          )}
        </div>
      </div>

      {/* Source breakdown bar */}
      {sourcesWithCount.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border bg-muted/10">
          {sourcesWithCount.map(([src, count]) => {
            const style = SOURCE_STYLES[src] ?? { label: src, className: "bg-muted text-muted-foreground border-muted" };
            return (
              <span
                key={src}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
              >
                {style.label}
                <span className="opacity-70">{count}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Job rows */}
      <div className="divide-y divide-border">
        {data.jobs.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            No job leads found. Try searching for jobs or connecting your Gmail.
          </div>
        ) : (
          data.jobs.map((job) => (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              {/* Left: company + title */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{job.company}</p>
                <p className="text-xs text-muted-foreground truncate">{job.title}</p>
              </div>

              {/* Middle: location + source */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                {job.location && (
                  <span className="text-xs text-muted-foreground truncate max-w-[100px]">{job.location}</span>
                )}
                <SourceBadge source={job.source} />
                {job.allSources.length > 1 && (
                  <span className="text-[10px] text-muted-foreground">{job.allSources.length} sources</span>
                )}
              </div>

              {/* Right: applied badge or apply button */}
              <div className="shrink-0">
                {appliedIds.has(job.id) ? (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Applied
                  </span>
                ) : (
                  <button
                    onClick={() => handleApply(job)}
                    disabled={applyingIds.has(job.id)}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {applyingIds.has(job.id) ? "…" : "Apply"}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border bg-muted/10">
        <a
          href="/dashboard/jobs"
          className="text-xs font-medium text-primary hover:underline"
        >
          View all in Jobs →
        </a>
      </div>
    </div>
  );
}
