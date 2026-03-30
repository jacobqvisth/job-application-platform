"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { AdzunaJobResult, JobListing } from "@/lib/types/database";

type Job = AdzunaJobResult | JobListing;

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => Promise<{ alreadySaved: boolean }>;
  isSaved?: boolean;
  alreadyApplied?: boolean;
}

function matchColor(score: number): string {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-blue-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-muted-foreground";
}

function matchTextColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-blue-600";
  if (score >= 40) return "text-yellow-600";
  return "text-muted-foreground";
}

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `£${(n / 1000).toFixed(0)}k` : `£${n.toLocaleString()}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return d.toLocaleDateString();
}

function remoteLabel(type: string | null): string | null {
  if (!type || type === "unknown") return null;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

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
  const style = SOURCE_STYLES[source] ?? {
    label: source,
    className: "bg-muted text-muted-foreground border-muted",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs px-1.5 py-0 font-normal ${style.className}`}
    >
      {style.label}
    </Badge>
  );
}

export function JobCard({ job, onSave, isSaved: initialSaved = false, alreadyApplied: propAlreadyApplied }: JobCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialSaved);

  const salary = formatSalary(job.salary_min, job.salary_max);
  const postedDate = formatDate(job.posted_at);
  const remote = remoteLabel(job.remote_type);
  const score = job.match_score;

  // JobListing-specific fields (not on AdzunaJobResult)
  const isJobListing = "all_sources" in job;
  const allSources = isJobListing ? (job as JobListing).all_sources ?? [] : [];
  const hasApplied = propAlreadyApplied ?? (isJobListing ? (job as JobListing).has_applied : false);
  const appliedAt = isJobListing ? (job as JobListing).applied_at : null;
  const applicationId = isJobListing ? (job as JobListing).application_id : null;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await onSave(job);
      setSaved(true);
      if (result.alreadySaved) {
        toast.info("Already saved to tracker");
      } else {
        toast.success("Saved to tracker", {
          action: {
            label: "View Applications",
            onClick: () => router.push("/dashboard/applications"),
          },
        });
      }
    } catch {
      toast.error("Failed to save job. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleQuickApply() {
    const description = (job.description ?? "").slice(0, 6000);
    const params = new URLSearchParams({
      company: job.company,
      role: job.title,
      jobDescription: description,
    });
    router.push(`/dashboard/draft?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-snug truncate">{job.title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {job.company}
            {job.location && ` · ${job.location}`}
            {remote && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                · 🏠 {remote}
              </span>
            )}
          </p>
        </div>
        {/* Match score */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-semibold ${matchTextColor(score)}`}>
            {score}% match
          </span>
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${matchColor(score)}`}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {salary && <span>{salary}</span>}
        {postedDate && <span>Posted {postedDate}</span>}
        {remote && (
          <Badge variant="secondary" className="text-xs">
            {remote}
          </Badge>
        )}
        {hasApplied && (
          applicationId ? (
            <Link
              href={`/dashboard/applications?id=${applicationId}`}
              className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium hover:bg-green-200 transition-colors"
            >
              <Check className="h-2.5 w-2.5" />
              Applied{appliedAt ? ` ${formatDate(appliedAt)}` : ""}
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 text-xs font-medium">
              <Check className="h-2.5 w-2.5" />
              Applied{appliedAt ? ` ${formatDate(appliedAt)}` : ""}
            </span>
          )
        )}
      </div>

      {/* Source badges */}
      {allSources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allSources.map((src) => (
            <SourceBadge key={src} source={src} />
          ))}
          {allSources.length > 1 && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 font-normal bg-amber-50 text-amber-700 border-amber-200">
              Multi-source
            </Badge>
          )}
        </div>
      )}

      {/* Expandable description */}
      {job.description && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-0 text-xs text-muted-foreground"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" />
                Hide description
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                Show description
              </>
            )}
          </Button>
          {expanded && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
              {job.description}
            </p>
          )}
        </>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button variant="outline" size="sm" asChild>
          <a href={job.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            View listing
          </a>
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={saved || saving}
          onClick={handleSave}
          className={saved ? "text-green-600 border-green-200" : ""}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Saved ✓
            </>
          ) : (
            "☆ Save to Tracker"
          )}
        </Button>

        <Button size="sm" onClick={handleQuickApply}>
          ✍ Quick Apply →
        </Button>
      </div>
    </div>
  );
}

// Skeleton placeholder for loading state
export function JobCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-muted rounded w-16" />
          <div className="h-1.5 bg-muted rounded w-20" />
        </div>
      </div>
      <div className="flex gap-3">
        <div className="h-3 bg-muted rounded w-24" />
        <div className="h-3 bg-muted rounded w-20" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-8 bg-muted rounded w-28" />
        <div className="h-8 bg-muted rounded w-32" />
        <div className="h-8 bg-muted rounded w-28" />
      </div>
    </div>
  );
}
