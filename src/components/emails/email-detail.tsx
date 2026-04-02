"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUpRight,
  Calendar,
  Link2,
  Reply,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import type { EmailWithApplication, Application } from "@/lib/types/database";
import {
  markEmailReadAction,
  linkEmailAction,
} from "@/app/(protected)/dashboard/actions/email-actions";
import { ReplyComposer } from "./reply-composer";

interface EmailDetailProps {
  email: EmailWithApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailDetail({ email, open, onOpenChange }: EmailDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [showReply, setShowReply] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [applications, setApplications] = useState<
    Pick<Application, "id" | "company" | "role">[]
  >([]);

  useEffect(() => {
    if (email && !email.is_read) {
      startTransition(async () => {
        await markEmailReadAction(email.id);
      });
    }
    setShowReply(false);
  }, [email]);

  useEffect(() => {
    if (open && !email?.application_id) {
      // Fetch applications for linking
      fetch("/api/gmail/applications")
        .then((r) => r.json())
        .then((data) => {
          if (data.applications) setApplications(data.applications);
        })
        .catch(() => {});
    }
  }, [open, email?.application_id]);

  if (!email) return null;

  async function handleExtractFromDetail() {
    if (!email) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/emails/extract-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Extraction failed");
        return;
      }

      if (data.alreadyExtracted) {
        toast.info(`${data.extracted.length} jobs already extracted from this email`, {
          action: {
            label: "View in Job Leads",
            onClick: () => { window.location.href = "/dashboard/job-leads"; },
          },
        });
        return;
      }

      toast.success(
        `Extracted ${data.newCount} new job${data.newCount !== 1 ? "s" : ""}${data.duplicateCount > 0 ? ` (${data.duplicateCount} already known)` : ""}`,
        {
          action: {
            label: "View in Job Leads",
            onClick: () => { window.location.href = "/dashboard/job-leads"; },
          },
        }
      );
    } catch {
      toast.error("Failed to extract jobs");
    } finally {
      setExtracting(false);
    }
  }

  function handleLink(applicationId: string) {
    startTransition(async () => {
      const result = await linkEmailAction(email!.id, applicationId);
      if (result.success) {
        toast.success("Email linked to application");
      } else {
        toast.error(result.error ?? "Failed to link email");
      }
    });
  }

  const sanitizedHtml = email.body_html
    ? DOMPurify.sanitize(email.body_html, {
        ALLOWED_TAGS: [
          "p",
          "br",
          "b",
          "i",
          "u",
          "strong",
          "em",
          "a",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "div",
          "span",
          "table",
          "thead",
          "tbody",
          "tr",
          "td",
          "th",
          "blockquote",
          "img",
        ],
        ALLOWED_ATTR: ["href", "src", "alt", "style", "class", "target"],
      })
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-lg">{email.subject}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2">
            <span className="text-xs">
              {email.direction === "inbound" ? "From" : "To"}:{" "}
              {email.direction === "inbound"
                ? email.from_address
                : email.to_address}
            </span>
            <span className="text-xs text-muted-foreground">
              <Calendar className="mr-1 inline size-3" />
              {new Date(email.received_at).toLocaleString()}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-8">
          {/* Classification & linked app */}
          <div className="flex flex-wrap items-center gap-2">
            {email.classification && (
              <Badge variant="secondary" className="capitalize">
                {email.classification.replace("_", " ")}
              </Badge>
            )}
            {email.classification === "job_alert" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExtractFromDetail}
                disabled={extracting}
              >
                {extracting ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-4" />
                )}
                Extract Jobs
              </Button>
            )}
            {email.applications ? (
              <Badge variant="outline">
                <ArrowUpRight className="mr-1 size-3" />
                {email.applications.company} — {email.applications.role}
              </Badge>
            ) : (
              applications.length > 0 && (
                <div className="flex items-center gap-2">
                  <Link2 className="size-3.5 text-muted-foreground" />
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleLink(e.target.value);
                    }}
                    disabled={isPending}
                    className="h-7 rounded border bg-background px-2 text-xs"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Link to application...
                    </option>
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.company} — {app.role}
                      </option>
                    ))}
                  </select>
                </div>
              )
            )}
          </div>

          <Separator />

          {/* Email Body */}
          {sanitizedHtml ? (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-sm text-muted-foreground">
              {email.body_preview || "No content"}
            </div>
          )}

          <Separator />

          {/* Reply */}
          {email.direction === "inbound" && !showReply && (
            <Button
              variant="outline"
              onClick={() => setShowReply(true)}
            >
              <Reply className="size-4" />
              Draft Reply
            </Button>
          )}

          {showReply && (
            <ReplyComposer
              emailId={email.id}
              threadId={email.gmail_thread_id}
              onClose={() => setShowReply(false)}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
