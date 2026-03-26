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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { createQuestionAction } from "@/app/(protected)/dashboard/answers/actions";
import { CATEGORY_LABELS } from "./category-badge";
import type { AnswerCategory } from "@/lib/types/database";

const CATEGORIES: AnswerCategory[] = [
  "behavioral",
  "technical",
  "motivational",
  "situational",
  "salary",
  "availability",
  "why_us",
  "why_role",
  "other",
];

export function AddQuestionDialog() {
  const [open, setOpen] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [category, setCategory] = useState<AnswerCategory>("other");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [firstAnswer, setFirstAnswer] = useState("");
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setQuestionText("");
    setCategory("other");
    setTagInput("");
    setTags([]);
    setFirstAnswer("");
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  async function handleAutoCategorize() {
    if (!questionText.trim()) {
      toast.error("Enter a question first");
      return;
    }
    setIsCategorizing(true);
    try {
      const res = await fetch("/api/answers/categorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText }),
      });
      if (!res.ok) throw new Error("Categorization failed");
      const data = await res.json() as { category: AnswerCategory; tags: string[] };
      setCategory(data.category);
      if (data.tags.length > 0) {
        setTags(data.tags);
      }
      toast.success("Category suggested");
    } catch {
      toast.error("Failed to auto-categorize");
    } finally {
      setIsCategorizing(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!questionText.trim()) return;

    startTransition(async () => {
      try {
        await createQuestionAction({
          canonical_text: questionText.trim(),
          category,
          tags,
          firstAnswer: firstAnswer || undefined,
        });
        toast.success("Question added to library");
        resetForm();
        setOpen(false);
      } catch {
        toast.error("Failed to add question");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Question
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Question to Library</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Question text */}
          <div className="space-y-1.5">
            <Label htmlFor="question-text">Question</Label>
            <Textarea
              id="question-text"
              placeholder="e.g. Tell me about a time you led a team through a difficult situation."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={2}
              className="resize-none"
              required
            />
          </div>

          {/* Category + Auto-categorize */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Category</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
                onClick={handleAutoCategorize}
                disabled={isCategorizing || !questionText.trim()}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {isCategorizing ? "Categorizing..." : "Auto-categorize"}
              </Button>
            </div>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as AnswerCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add tag, press Enter"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={addTag}
                className="flex-1 h-9 text-sm"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 pr-1 text-xs"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* First answer (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="first-answer">
              First Answer{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="first-answer"
              placeholder="Write your answer to this question..."
              value={firstAnswer}
              onChange={(e) => setFirstAnswer(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending || !questionText.trim()}>
              {isPending ? "Saving..." : "Add to Library"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                resetForm();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
