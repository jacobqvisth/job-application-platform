"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { generatePrepPackAction } from "@/app/(protected)/dashboard/applications/[id]/actions";
import type { PrepPack, PrepQuestion } from "@/lib/data/prep";
import { cn } from "@/lib/utils";

interface DetailPrepProps {
  applicationId: string;
  prepPack: PrepPack | null;
  hasJobDescription: boolean;
}

const CATEGORY_LABELS: Record<PrepQuestion["category"], string> = {
  behavioral: "Behavioral Questions",
  "role-specific": "Role-Specific Questions",
  motivation: "Motivation & Culture",
  technical: "Technical / Domain",
};

const CATEGORY_ORDER: PrepQuestion["category"][] = [
  "behavioral",
  "role-specific",
  "motivation",
  "technical",
];

export function DetailPrep({
  applicationId,
  prepPack,
  hasJobDescription,
}: DetailPrepProps) {
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      await generatePrepPackAction(applicationId);
    });
  }

  function handleRegenerate() {
    const confirmed = window.confirm(
      "Regenerate? This will replace your current prep pack."
    );
    if (!confirmed) return;
    startTransition(async () => {
      await generatePrepPackAction(applicationId);
    });
  }

  // Empty state
  if (!prepPack) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-4">
        <div className="space-y-2">
          <p className="text-2xl">🎯</p>
          <h3 className="text-base font-semibold">Interview Prep Pack</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Get a tailored prep pack for this role — likely questions, key
            themes to emphasize, and a quick company brief based on the job
            description.
          </p>
        </div>

        <Button onClick={handleGenerate} disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating your prep pack…
            </>
          ) : (
            "Generate Prep Pack"
          )}
        </Button>

        {!hasJobDescription && (
          <p className="text-xs text-muted-foreground">
            ⓘ Works best when a job description is saved.
          </p>
        )}
      </div>
    );
  }

  // Group questions by category
  const byCategory = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      acc[cat] = prepPack.likely_questions.filter((q) => q.category === cat);
      return acc;
    },
    {} as Record<PrepQuestion["category"], PrepQuestion[]>
  );

  const generatedAt = new Date(prepPack.generated_at).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="space-y-6">
      {/* Company Brief */}
      {prepPack.company_brief && (
        <blockquote className="rounded-lg border-l-4 border-primary/30 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground italic">
          {prepPack.company_brief}
        </blockquote>
      )}

      {/* Key Themes */}
      {prepPack.key_themes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
            📌 What to Emphasize
          </h3>
          <ul className="space-y-2">
            {prepPack.key_themes.map((theme, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/60" />
                {theme}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Likely Questions by Category */}
      <div className="space-y-5">
        {CATEGORY_ORDER.map((cat) => {
          const questions = byCategory[cat];
          if (!questions?.length) return null;

          return (
            <div key={cat} className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border px-4 py-3 space-y-1",
                      "bg-purple-50/50 dark:bg-purple-950/10"
                    )}
                  >
                    <p className="text-sm font-medium leading-snug">
                      {q.question}
                    </p>
                    {q.star_prompt && (
                      <p className="text-sm text-amber-700 dark:text-amber-400 italic mt-1">
                        💡 {q.star_prompt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          Generated {generatedAt}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={isPending}
          className="text-xs"
        >
          {isPending ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Regenerating…
            </>
          ) : (
            "Regenerate"
          )}
        </Button>
      </div>
    </div>
  );
}
