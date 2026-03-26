"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const QUICK_SUGGESTIONS = [
  "Make it shorter",
  "Make it more specific",
  "More formal",
  "Less formal",
  "Add metrics",
];

interface ImproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "cover_letter" | "screening_answer";
  content: string;
  question?: string;
  jobDescription: string;
  onImproved: (improved: string) => void;
}

export function ImproveDialog({
  open,
  onOpenChange,
  type,
  content,
  question,
  jobDescription,
  onImproved,
}: ImproveDialogProps) {
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);

  const label = type === "cover_letter" ? "cover letter" : "answer";

  async function handleImprove() {
    if (!instruction.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/application/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          content,
          instruction,
          jobDescription,
          question,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to improve content");
        return;
      }
      onImproved(data.improved);
      onOpenChange(false);
      setInstruction("");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Improve {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInstruction(s)}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
          <Textarea
            placeholder={`How should I improve the ${label}? e.g. "Make it shorter and more direct"`}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleImprove();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleImprove} disabled={loading || !instruction.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Improve
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
