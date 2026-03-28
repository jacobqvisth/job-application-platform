"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, RotateCcw, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticeQuestionData } from "@/lib/chat/types";

const SCORE_CONFIG: Record<string, { label: string; className: string }> = {
  strong: { label: "Strong", className: "bg-green-100 text-green-700 border-green-200" },
  good: { label: "Good", className: "bg-blue-100 text-blue-700 border-blue-200" },
  needs_work: { label: "Needs Work", className: "bg-amber-100 text-amber-700 border-amber-200" },
};

interface Props {
  data: PracticeQuestionData;
  onAppend?: (content: string) => void;
}

export function PracticeQuestionCard({ data, onAppend }: Props) {
  const isEvaluation = !!data.userAnswer && !!data.evaluation;

  const progressLabel = `Question ${data.questionIndex + 1} of ${data.totalQuestions}`;

  if (!isEvaluation) {
    // ── Question mode: just show the question ──
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">
                Practice Interview · {data.company}
              </p>
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">
              Q{data.questionIndex + 1}/{data.totalQuestions}
            </Badge>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-medium leading-relaxed">{data.question}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            Type your answer below, or use voice input.
          </p>
        </div>
      </div>
    );
  }

  // ── Evaluation mode: show question + answer + feedback ──
  const scoreConfig =
    SCORE_CONFIG[data.evaluation!.score] ?? SCORE_CONFIG.good;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">
              Practice Interview · {data.company}
            </p>
            <p className="text-xs text-muted-foreground">{progressLabel}</p>
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs shrink-0", scoreConfig.className)}
          >
            {scoreConfig.label}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Question */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Question
          </p>
          <p className="text-xs font-medium leading-snug">{data.question}</p>
        </div>

        {/* User's answer */}
        {data.userAnswer && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Your Answer
            </p>
            <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground leading-relaxed italic">
              {data.userAnswer}
            </blockquote>
          </div>
        )}

        {/* Feedback */}
        {data.evaluation?.feedback && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Feedback
            </p>
            <p className="text-xs text-foreground leading-relaxed">
              {data.evaluation.feedback}
            </p>
          </div>
        )}

        {/* Improvement suggestions */}
        {data.evaluation?.suggestions && data.evaluation.suggestions.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Improvements
            </p>
            <ul className="space-y-1">
              {data.evaluation.suggestions.map((s, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5">
                  <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-muted/30 flex-wrap">
        {!data.isLastQuestion ? (
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() =>
              onAppend?.(
                `Ask me question ${data.questionIndex + 2} for my ${data.company} interview practice`
              )
            }
          >
            <ChevronRight className="h-3 w-3" />
            Next Question
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() =>
              onAppend?.(
                `Summarize my interview practice session for ${data.company} — give me an overall assessment`
              )
            }
          >
            See Overall Results
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={() =>
            onAppend?.(
              `Let me try question ${data.questionIndex + 1} again for my ${data.company} interview practice`
            )
          }
        >
          <RotateCcw className="h-3 w-3" />
          Try Again
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs gap-1.5 text-muted-foreground"
          onClick={() =>
            onAppend?.(
              `End my interview practice for ${data.company} and give me a summary of how I did`
            )
          }
        >
          <Square className="h-3 w-3" />
          End Practice
        </Button>
      </div>
    </div>
  );
}
