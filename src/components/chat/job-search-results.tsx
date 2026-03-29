"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, ExternalLink, MapPin, Briefcase, Bookmark } from "lucide-react";
import type { SearchJobsResult, JobResult } from "@/lib/chat/types";

interface Props {
  data: SearchJobsResult;
  onAppend?: (content: string) => void;
}

function matchColor(score: number) {
  if (score >= 85) return "border-l-green-500";
  if (score >= 60) return "border-l-yellow-500";
  return "border-l-zinc-300";
}

function matchBadgeVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 85) return "default";
  if (score >= 60) return "secondary";
  return "outline";
}

function JobCard({ job, onAppend }: { job: JobResult; onAppend?: (content: string) => void }) {
  const [expanded, setExpanded] = useState(false);

  const salaryText = job.salary ?? null;
  const locationText = [job.location, job.remoteType].filter(Boolean).join(" · ");

  return (
    <Card className={`border-l-4 ${matchColor(job.matchScore)} overflow-hidden`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">{job.title}</h3>
              <Badge variant={matchBadgeVariant(job.matchScore)} className="text-xs shrink-0">
                {job.matchScore}% match
              </Badge>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.company}</span>
              {locationText && (
                <>
                  <span>·</span>
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{locationText}</span>
                </>
              )}
              {salaryText && (
                <>
                  <span>·</span>
                  <span>{salaryText}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {expanded && job.description && (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed line-clamp-6">
            {job.description.slice(0, 600)}
            {job.description.length > 600 ? "..." : ""}
          </p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onAppend?.(
                `Prepare an application for ${job.title} at ${job.company}. Job description:\n\n${job.description}`
              )
            }
          >
            Quick Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() =>
              onAppend?.(
                `Save this job to my tracker: ${job.title} at ${job.company}, ${job.location ?? "location unknown"}, URL: ${job.url}`
              )
            }
          >
            <Bookmark className="h-3 w-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" /> Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" /> View JD
              </>
            )}
          </Button>
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function JobSearchResults({ data, onAppend }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? data.jobs : data.jobs.slice(0, 5);

  if (data.jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            No job listings found matching &ldquo;{data.query}&rdquo;.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data.source === "cached"
              ? "These results are from cached searches. Try a more specific query to search live."
              : "Try different keywords, a broader search, or a different location."}
          </p>
          <div className="flex gap-2 justify-center mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAppend?.("Search for product manager jobs in Stockholm")}
            >
              Try a sample search
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAppend?.(`Save a job search alert for: ${data.query}`)}
            >
              Save as alert
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">
        {data.total} job{data.total !== 1 ? "s" : ""} found
        {data.query ? ` for "${data.query}"` : ""}
        {data.source === "live" && (
          <span className="ml-1 text-green-600">· Live results</span>
        )}
      </p>
      <div className="space-y-2">
        {displayed.map((job) => (
          <JobCard key={job.id} job={job} onAppend={onAppend} />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {data.jobs.length > 5 && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show less" : `Show all ${data.jobs.length} jobs`}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-xs ml-auto"
          onClick={() => onAppend?.(`Save this job search as an alert: ${data.query}`)}
        >
          <Bookmark className="h-3 w-3 mr-1" />
          Save search
        </Button>
      </div>
    </div>
  );
}
