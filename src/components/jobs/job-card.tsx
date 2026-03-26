"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, ChevronUp, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { AdzunaJobResult, JobListing } from "@/lib/types/database";

type Job = AdzunaJobResult | JobListing;

interface JobCardProps {
  job: Job;
  onSave: (job: Job) => Promise<{ alreadySaved: boolean }>;
  isSaved?: boolean;
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

export function JobCard({ job, onSave, isSaved: initialSaved = false }: JobCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(initialSaved);

  const salary = formatSalary(job.salary_min, job.salary_max);
  const postedDate = formatDate(job.posted_at);
  const remote = remoteLabel(job.remote_type);
  const score = job.match_score;

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
      </div>

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
