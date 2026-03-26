"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { linkAnswerAction, createQuestionAction } from "@/app/(protected)/dashboard/answers/actions";
import { CategoryBadge } from "./category-badge";
import type { CanonicalQuestion, ScreeningAnswer } from "@/lib/types/database";

interface LinkAnswerDialogProps {
  answer: ScreeningAnswer;
  canonicalQuestions: CanonicalQuestion[];
}

export function LinkAnswerDialog({
  answer,
  canonicalQuestions,
}: LinkAnswerDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newQuestionText, setNewQuestionText] = useState(answer.question);
  const [isPending, startTransition] = useTransition();

  const filtered = canonicalQuestions.filter((q) =>
    q.canonical_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function handleLinkToExisting(canonicalId: string) {
    startTransition(async () => {
      try {
        await linkAnswerAction(answer.id, canonicalId);
        toast.success("Answer linked");
        setOpen(false);
      } catch {
        toast.error("Failed to link answer");
      }
    });
  }

  function handleCreateNew(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    startTransition(async () => {
      try {
        await createQuestionAction({
          canonical_text: newQuestionText.trim(),
          category: "other",
          tags: [],
          firstAnswer: answer.answer,
        });
        toast.success("New question created with this answer");
        setOpen(false);
      } catch {
        toast.error("Failed to create question");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          Link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link to Canonical Question</DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
            Answer: <span className="text-foreground">{answer.answer}</span>
          </p>

          <Tabs defaultValue="existing">
            <TabsList className="w-full">
              <TabsTrigger value="existing" className="flex-1">
                Link to Existing
              </TabsTrigger>
              <TabsTrigger value="new" className="flex-1">
                Create New
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 mt-3">
              <Input
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="h-52 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No questions found
                  </p>
                ) : (
                  <div className="space-y-2 pr-1">
                    {filtered.map((q) => (
                      <button
                        key={q.id}
                        className="w-full text-left rounded-lg border p-3 hover:bg-muted transition-colors space-y-1"
                        onClick={() => handleLinkToExisting(q.id)}
                        disabled={isPending}
                      >
                        <p className="text-sm font-medium line-clamp-2">
                          {q.canonical_text}
                        </p>
                        <CategoryBadge category={q.category} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="new" className="mt-3">
              <form onSubmit={handleCreateNew} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Canonical question text</Label>
                  <Input
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    placeholder="Enter the canonical question..."
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This will create a new question and save the answer as a variant.
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !newQuestionText.trim()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Creating..." : "Create Question"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
