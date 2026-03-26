"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryBadge } from "./category-badge";
import { AnswerVariant } from "./answer-variant";
import { createAnswerAction, deleteQuestionAction } from "@/app/(protected)/dashboard/answers/actions";
import type { CanonicalQuestionWithAnswers } from "@/lib/types/database";

interface QuestionCardProps {
  question: CanonicalQuestionWithAnswers;
}

export function QuestionCard({ question }: QuestionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddAnswer, setShowAddAnswer] = useState(false);
  const [newAnswerText, setNewAnswerText] = useState("");
  const [isPending, startTransition] = useTransition();

  const answerCount = question.screening_answers.length;

  function handleAddAnswer() {
    const trimmed = newAnswerText.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        await createAnswerAction({
          question: question.canonical_text,
          answer: trimmed,
          canonical_question_id: question.id,
        });
        setNewAnswerText("");
        setShowAddAnswer(false);
        toast.success("Answer added");
      } catch {
        toast.error("Failed to add answer");
      }
    });
  }

  function handleDeleteQuestion() {
    startTransition(async () => {
      try {
        await deleteQuestionAction(question.id);
        toast.success("Question deleted");
      } catch {
        toast.error("Failed to delete question");
      }
    });
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Card header */}
      <div className="flex items-start gap-3 p-4">
        <button
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <button
            className="text-left w-full"
            onClick={() => setIsOpen((v) => !v)}
          >
            <p className="text-sm font-medium leading-snug hover:text-primary transition-colors">
              {question.canonical_text}
            </p>
          </button>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <CategoryBadge category={question.category} />
            {question.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs font-normal"
              >
                {tag}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground">
              {answerCount} {answerCount === 1 ? "answer" : "answers"}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={handleDeleteQuestion}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Expanded content */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t pt-4">
          {question.screening_answers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">
              No answers yet. Add one below.
            </p>
          ) : (
            question.screening_answers.map((answer) => (
              <AnswerVariant key={answer.id} answer={answer} />
            ))
          )}

          {/* Add answer form */}
          {showAddAnswer ? (
            <div className="space-y-2 pt-1">
              <Textarea
                placeholder="Write a new answer variant..."
                value={newAnswerText}
                onChange={(e) => setNewAnswerText(e.target.value)}
                rows={3}
                className="text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddAnswer}
                  disabled={isPending || !newAnswerText.trim()}
                  className="h-8"
                >
                  Save Answer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddAnswer(false);
                    setNewAnswerText("");
                  }}
                  disabled={isPending}
                  className="h-8"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 border-dashed text-muted-foreground hover:text-foreground"
              onClick={() => setShowAddAnswer(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Answer
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
