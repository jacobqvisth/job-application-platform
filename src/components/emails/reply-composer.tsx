"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Sparkles, Send, X, RefreshCw } from "lucide-react";

interface ReplyComposerProps {
  emailId: string;
  threadId: string;
  onClose: () => void;
}

type Tone = "professional" | "friendly" | "brief";

export function ReplyComposer({
  emailId,
  threadId,
  onClose,
}: ReplyComposerProps) {
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/gmail/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, tone }),
      });
      const data = await res.json();
      if (data.success) {
        setDraft(data.draft);
      } else {
        toast.error(data.error || "Failed to generate draft");
      }
    } catch {
      toast.error("Failed to generate draft");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSend() {
    if (!draft.trim()) {
      toast.error("Please write a reply first");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId, replyBody: draft, threadId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reply sent!");
        onClose();
      } else {
        toast.error(data.error || "Failed to send reply");
      }
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Draft Reply</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* AI Generate */}
      <div className="flex items-center gap-2">
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value as Tone)}
          className="h-8 rounded border bg-background px-2 text-sm"
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="brief">Brief</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {generating
            ? "Generating..."
            : draft
              ? "Regenerate"
              : "Generate with AI"}
        </Button>
      </div>

      {/* Editable Draft */}
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={8}
        placeholder="Write your reply or click 'Generate with AI' to get started..."
        disabled={sending}
      />

      {/* Send */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
        >
          <Send className="size-4" />
          {sending ? "Sending..." : "Send Reply"}
        </Button>
      </div>
    </div>
  );
}
