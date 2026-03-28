"use client";

import Link from "next/link";
import { ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { InterviewPrepData } from "@/lib/chat/types";

const TYPE_COLORS: Record<string, string> = {
  behavioral: "bg-blue-100 text-blue-700",
  technical: "bg-purple-100 text-purple-700",
  situational: "bg-yellow-100 text-yellow-700",
  motivational: "bg-green-100 text-green-700",
};

interface Props {
  data: InterviewPrepData;
  onAppend?: (content: string) => void;
}

function QuestionCard({
  question,
  index,
}: {
  question: InterviewPrepData["questions"][number];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <button
        className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <span className="shrink-0 text-[10px] font-bold text-muted-foreground/60 mt-0.5 w-4">
            Q{index + 1}
          </span>
          <p className="text-xs font-medium leading-snug">{question.question}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant="secondary"
            className={cn(
              "text-[9px] py-0 px-1 h-4 capitalize",
              TYPE_COLORS[question.type] ?? "bg-muted text-muted-foreground"
            )}
          >
            {question.type}
          </Badge>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-border/50 bg-muted/20">
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {question.answerOutline}
          </p>
        </div>
      )}
    </div>
  );
}

export function InterviewPrepInline({ data, onAppend }: Props) {
  const applicationHref = data.applicationId
    ? `/dashboard/applications/${data.applicationId}`
    : "/dashboard/applications";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">Interview Prep · {data.company}</p>
            <p className="text-xs text-muted-foreground">{data.role}</p>
          </div>
          <Link
            href={applicationHref}
            className="flex items-center gap-1 text-xs text-[oklch(0.44_0.19_265)] hover:underline shrink-0"
          >
            Full prep
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Research summary */}
        {data.researchSummary && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Company Context
            </p>
            <p className="text-xs text-foreground leading-relaxed">{data.researchSummary}</p>
          </div>
        )}

        {/* Key talking points */}
        {data.keyTalkingPoints.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Key Talking Points
            </p>
            <div className="flex flex-wrap gap-1">
              {data.keyTalkingPoints.map((point) => (
                <Badge key={point} variant="secondary" className="text-[10px] py-0 px-1.5 h-5">
                  {point}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Questions */}
        {data.questions.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Likely Questions — click to expand
            </p>
            <div className="space-y-1.5">
              {data.questions.map((q, i) => (
                <QuestionCard key={i} question={q} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-muted/30">
        <Link
          href={applicationHref}
          className="text-xs text-[oklch(0.44_0.19_265)] hover:underline flex items-center gap-1"
        >
          View full prep
          <ExternalLink className="h-3 w-3" />
        </Link>
        <span className="text-muted-foreground/30">·</span>
        <button
          className="text-xs text-[oklch(0.44_0.19_265)] hover:underline"
          onClick={() =>
            onAppend?.(
              `Let's practice interview questions for ${data.company}. Start with the first question.`
            )
          }
        >
          Practice with me →
        </button>
      </div>
    </div>
  );
}
