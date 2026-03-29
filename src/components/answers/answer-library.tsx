"use client";

import { useState } from "react";
import { BookOpen } from "lucide-react";
import { AnswerFilters } from "./answer-filters";
import { QuestionCard } from "./question-card";
import { LinkAnswerDialog } from "./link-answer-dialog";
import { Badge } from "@/components/ui/badge";
import type {
  CanonicalQuestionWithAnswers,
  ScreeningAnswer,
  AnswerCategory,
  AnswerRating,
} from "@/lib/types/database";

interface AnswerLibraryProps {
  questions: CanonicalQuestionWithAnswers[];
  orphanAnswers: ScreeningAnswer[];
}

function matchesSearch(question: CanonicalQuestionWithAnswers, search: string): boolean {
  const q = search.toLowerCase();
  if (question.canonical_text.toLowerCase().includes(q)) return true;
  return question.screening_answers.some(
    (a) => a.answer.toLowerCase().includes(q) || a.question.toLowerCase().includes(q)
  );
}

function matchesRating(question: CanonicalQuestionWithAnswers, rating: string): boolean {
  if (rating === "all") return true;
  return question.screening_answers.some((a) => a.rating === (rating as AnswerRating));
}

export function AnswerLibrary({ questions, orphanAnswers }: AnswerLibraryProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");

  const filtered = questions.filter((q) => {
    if (categoryFilter !== "all" && q.category !== (categoryFilter as AnswerCategory)) {
      return false;
    }
    if (!matchesRating(q, ratingFilter)) return false;
    if (searchFilter.trim() && !matchesSearch(q, searchFilter)) return false;
    return true;
  });

  const hasFilters =
    categoryFilter !== "all" || ratingFilter !== "all" || searchFilter.trim() !== "";

  if (questions.length === 0 && orphanAnswers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your Answer Library is empty</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Add canonical questions and their answer variants here. Answers you save
          during the Draft Application flow will also appear here once linked.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <AnswerFilters
        category={categoryFilter}
        rating={ratingFilter}
        search={searchFilter}
        onCategoryChange={setCategoryFilter}
        onRatingChange={setRatingFilter}
        onSearchChange={setSearchFilter}
      />

      {/* Question cards */}
      {filtered.length === 0 && hasFilters ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No questions match your filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      )}

      {/* Orphan answers section */}
      {orphanAnswers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pt-4 border-t">
            <h2 className="text-base font-semibold">Unlinked Answers</h2>
            <Badge variant="secondary">{orphanAnswers.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            These answers are not linked to a canonical question yet. Link them
            to organize your library.
          </p>
          <div className="space-y-3">
            {orphanAnswers.map((answer) => (
              <div
                key={answer.id}
                className="rounded-xl border bg-card p-4 space-y-3"
              >
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Question
                  </p>
                  <p className="text-sm">{answer.question}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Answer
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {answer.answer}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {answer.tags.length > 0 && (
                    <div className="flex gap-1">
                      {answer.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex-1" />
                  <LinkAnswerDialog
                    answer={answer}
                    canonicalQuestions={questions}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
