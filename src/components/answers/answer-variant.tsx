"use client";

import { useState, useTransition, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { updateAnswerAction, deleteAnswerAction, updateAnswerRatingAction } from "@/app/(protected)/dashboard/answers/actions";
import type { ScreeningAnswer, AnswerRating, AnswerTone } from "@/lib/types/database";

const RATING_CONFIG: Record<AnswerRating, { label: string; dotClass: string }> = {
  strong: { label: "Strong", dotClass: "bg-green-500" },
  good: { label: "Good", dotClass: "bg-blue-500" },
  needs_work: { label: "Needs Work", dotClass: "bg-orange-500" },
  untested: { label: "Untested", dotClass: "bg-zinc-400" },
};

const TONE_LABELS: Record<AnswerTone, string> = {
  formal: "Formal",
  conversational: "Conversational",
  concise: "Concise",
  detailed: "Detailed",
  neutral: "Neutral",
};

const RATINGS: AnswerRating[] = ["strong", "good", "needs_work", "untested"];

interface AnswerVariantProps {
  answer: ScreeningAnswer;
}

export function AnswerVariant({ answer }: AnswerVariantProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(answer.answer);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function startEdit() {
    setEditText(answer.answer);
    setIsEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  function cancelEdit() {
    setEditText(answer.answer);
    setIsEditing(false);
  }

  function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === answer.answer) {
      cancelEdit();
      return;
    }
    startTransition(async () => {
      try {
        await updateAnswerAction(answer.id, { answer: trimmed });
        setIsEditing(false);
        toast.success("Answer updated");
      } catch {
        toast.error("Failed to update answer");
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  function handleRatingChange(rating: AnswerRating) {
    startTransition(async () => {
      try {
        await updateAnswerRatingAction(answer.id, rating);
        toast.success("Rating updated");
      } catch {
        toast.error("Failed to update rating");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteAnswerAction(answer.id);
        toast.success("Answer deleted");
      } catch {
        toast.error("Failed to delete answer");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      {/* Answer text */}
      <div className="group relative">
        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={isPending}
                className="h-7 px-3 text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelEdit}
                disabled={isPending}
                className="h-7 px-3 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm leading-relaxed cursor-pointer hover:bg-muted/50 rounded p-2 -m-2 transition-colors whitespace-pre-wrap"
            onClick={startEdit}
            title="Click to edit"
          >
            {answer.answer}
          </div>
        )}
        {!isEditing && (
          <button
            onClick={startEdit}
            className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
          >
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Rating selector */}
        <div className="flex items-center gap-1">
          {RATINGS.map((r) => {
            const cfg = RATING_CONFIG[r];
            const isActive = answer.rating === r;
            return (
              <button
                key={r}
                onClick={() => !isActive && handleRatingChange(r)}
                disabled={isPending}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors border ${
                  isActive
                    ? "bg-background border-border shadow-sm"
                    : "border-transparent text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dotClass}`} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Tone badge */}
        <Badge variant="outline" className="text-xs font-normal capitalize">
          {TONE_LABELS[answer.tone]}
        </Badge>

        {/* Usage count */}
        {answer.usage_count > 0 && (
          <span className="text-xs text-muted-foreground">
            Used {answer.usage_count}×
          </span>
        )}

        {/* Delete */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
