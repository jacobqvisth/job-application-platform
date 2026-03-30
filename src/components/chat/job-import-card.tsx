"use client";

import { CheckCircle2, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { JobImportResult } from "@/lib/chat/types";

interface JobImportCardProps {
  data: JobImportResult;
}

function statusBadge(status: string) {
  switch (status) {
    case "applied":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Applied</Badge>;
    case "interviewing":
      return <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-xs">Interviewing</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Rejected</Badge>;
    case "seen":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">Seen</Badge>;
    default:
      return null;
  }
}

export function JobImportCard({ data }: JobImportCardProps) {
  if (data.errorMessage && data.jobs.length === 0) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Screenshot Import Failed
        </div>
        <p className="text-xs text-muted-foreground">{data.errorMessage}</p>
      </div>
    );
  }

  const newJobs = data.jobs.filter((j) => j.isNew && !j.alreadyApplied);
  const alreadyTracked = data.jobs.filter((j) => !j.isNew || j.alreadyApplied);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">
              Imported from screenshot
            </span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {data.jobs.length} job{data.jobs.length !== 1 ? "s" : ""} found
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {newJobs.length > 0 && `${newJobs.length} new added`}
          {newJobs.length > 0 && alreadyTracked.length > 0 && " · "}
          {alreadyTracked.length > 0 && `${alreadyTracked.length} already tracked`}
        </p>
      </div>

      {/* Job list */}
      <div className="divide-y">
        {data.jobs.map((job, idx) => (
          <div key={idx} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium leading-snug truncate">{job.title}</p>
              <p className="text-xs text-muted-foreground">{job.company}</p>
              {job.warningMessage && (
                <p className="text-xs text-amber-600">{job.warningMessage}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {statusBadge(job.status)}
              {job.isNew && !job.alreadyApplied ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                  Added
                </Badge>
              ) : job.alreadyApplied ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                  Already applied
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  <Clock className="mr-1 h-2.5 w-2.5" />
                  Tracked
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t bg-muted/20">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          View all jobs
        </Link>
      </div>
    </div>
  );
}
