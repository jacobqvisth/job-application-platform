"use client";

import { ExternalLink, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { StartApplicationResult } from "@/lib/chat/types";

interface Props {
  data: StartApplicationResult;
}

export function ApplicationStartedCard({ data }: Props) {
  if (!data.success) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Couldn&apos;t track this application — try from the Jobs page.
      </div>
    );
  }

  if (data.alreadyExisted) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden w-full">
        <div className="px-4 py-3 border-b border-blue-200 bg-blue-100/50">
          <span className="text-sm font-semibold text-blue-800">Already in Tracker</span>
        </div>
        <div className="px-4 py-3 space-y-3">
          <div>
            <p className="text-sm font-semibold">{data.company}</p>
            <p className="text-xs text-muted-foreground">{data.role}</p>
          </div>
          <Link
            href={data.applicationId ? `/dashboard/applications?id=${data.applicationId}` : "/dashboard/applications"}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
          >
            View in Kanban
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 overflow-hidden w-full">
      <div className="px-4 py-3 border-b border-green-200 bg-green-100/50 flex items-center gap-2">
        <Check className="h-4 w-4 text-green-700" />
        <span className="text-sm font-semibold text-green-800">Application Tracked</span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <div>
          <p className="text-sm font-semibold">{data.company}</p>
          <p className="text-xs text-muted-foreground">{data.role}</p>
        </div>
        <p className="text-xs text-green-700">Added to your kanban as Applied</p>
        <div className="flex items-center gap-3">
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 transition-colors"
            >
              Open Application Form
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <Link
            href="/dashboard/applications"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            View Kanban
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
