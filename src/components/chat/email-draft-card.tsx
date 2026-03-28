"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, Mail, Check } from "lucide-react";
import type { EmailDraftData } from "@/lib/chat/types";

const EMAIL_TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  thank_you: "Thank You",
  check_in: "Check-in",
};

interface Props {
  data: EmailDraftData;
  onAppend?: (content: string) => void;
}

export function EmailDraftCard({ data, onAppend }: Props) {
  const [copied, setCopied] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [subject, setSubject] = useState(data.subject);

  const typeLabel = EMAIL_TYPE_LABELS[data.emailType] ?? "Email";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${data.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing if clipboard API unavailable
    }
  };

  const handleRegenerate = () => {
    onAppend?.(
      `Regenerate the follow-up email for ${data.company} with a different approach`
    );
  };

  // Construct Gmail compose URL (works even without a contact email)
  const gmailUrl = data.contactEmail
    ? `mailto:${data.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(data.body)}`
    : `https://mail.google.com/mail/?view=cm&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(data.body)}`;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden w-full max-w-2xl">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">
              {typeLabel} email — {data.role} at {data.company}
            </p>
            {data.daysSinceApplied !== undefined && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {data.daysSinceApplied} day{data.daysSinceApplied !== 1 ? "s" : ""} since applied
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {typeLabel}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Subject line */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Subject
          </p>
          {editingSubject ? (
            <input
              className="w-full text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => setEditingSubject(false)}
              autoFocus
            />
          ) : (
            <button
              className="text-sm text-left hover:underline decoration-dashed underline-offset-2 text-foreground"
              onClick={() => setEditingSubject(true)}
              title="Click to edit subject"
            >
              {subject}
            </button>
          )}
        </div>

        {/* Email body */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Body
          </p>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 max-h-56 overflow-y-auto">
            <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans">
              {data.body}
            </pre>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border bg-muted/30 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied!" : "Copy"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={handleRegenerate}
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
        <a
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 h-7 px-3 text-xs rounded-md border border-border bg-background hover:bg-muted/50 transition-colors"
        >
          <Mail className="h-3 w-3" />
          Open in Gmail
        </a>
      </div>
    </div>
  );
}
