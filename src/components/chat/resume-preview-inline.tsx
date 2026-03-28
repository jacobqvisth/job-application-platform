"use client";

import Link from "next/link";
import { ExternalLink, MapPin, Mail, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResumePreviewData } from "@/lib/chat/types";

interface Props {
  data: ResumePreviewData;
  onAppend?: (content: string) => void;
}

export function ResumePreviewInline({ data, onAppend }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">
              {data.contactName ?? data.resumeName}
            </p>
            {data.currentTitle && (
              <p className="text-xs text-muted-foreground">{data.currentTitle}</p>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {data.contactEmail && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {data.contactEmail}
                </span>
              )}
              {data.contactLocation && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {data.contactLocation}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] text-muted-foreground">
              {data.resumeCount} resume{data.resumeCount !== 1 ? "s" : ""}
            </span>
            <Link
              href="/dashboard/resumes"
              className="flex items-center gap-1 text-xs text-[oklch(0.44_0.19_265)] hover:underline"
            >
              <FileText className="h-3 w-3" />
              View all
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        {data.summary && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Summary
            </p>
            <p className="text-xs text-foreground leading-relaxed line-clamp-3">{data.summary}</p>
          </div>
        )}

        {/* Experience */}
        {data.topExperiences.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Experience
            </p>
            <div className="space-y-2.5">
              {data.topExperiences.map((exp, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold truncate">{exp.role}</p>
                    <p className="text-[11px] text-muted-foreground shrink-0 whitespace-nowrap">
                      {exp.startDate}
                      {exp.endDate !== undefined ? ` – ${exp.endDate ?? "Present"}` : ""}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{exp.company}</p>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="ml-3 mt-1 space-y-0.5">
                      {exp.bullets.slice(0, 2).map((bullet, bi) => (
                        <li key={bi} className="text-[11px] text-muted-foreground list-disc">
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {data.skills.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Skills
            </p>
            <div className="flex flex-wrap gap-1">
              {data.skills
                .flatMap((g) => g.items)
                .slice(0, 12)
                .map((skill) => (
                  <Badge key={skill} variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
                    {skill}
                  </Badge>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/30">
        <Link
          href="/dashboard/resumes"
          className="text-xs text-[oklch(0.44_0.19_265)] hover:underline flex items-center gap-1"
        >
          View full resume
          <ExternalLink className="h-3 w-3" />
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <button
          className="text-xs text-[oklch(0.44_0.19_265)] hover:underline"
          onClick={() => onAppend?.("Tailor my resume for a specific job I'm applying to")}
        >
          Tailor for a job →
        </button>
      </div>
    </div>
  );
}
