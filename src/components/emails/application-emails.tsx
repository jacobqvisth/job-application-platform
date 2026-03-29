"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  MailOpen,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import type { Email } from "@/lib/types/database";
import Link from "next/link";

interface ApplicationEmailsProps {
  applicationId: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ApplicationEmails({ applicationId }: ApplicationEmailsProps) {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/gmail/application-emails?applicationId=${applicationId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.emails) setEmails(data.emails);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Loading emails...
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 text-center text-muted-foreground">
        <Mail className="mb-2 size-6" />
        <p className="text-sm">No emails linked to this application</p>
        <Link
          href="/dashboard/emails"
          className="mt-2 text-xs text-primary hover:underline"
        >
          View all emails
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {emails.map((email) => (
        <div
          key={email.id}
          className="flex items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
        >
          <div className="mt-0.5 shrink-0">
            {email.direction === "inbound" ? (
              <ArrowLeft className="size-3.5 text-blue-500" />
            ) : (
              <ArrowRight className="size-3.5 text-green-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {email.is_read ? (
                <MailOpen className="size-3 text-muted-foreground" />
              ) : (
                <Mail className="size-3 text-primary" />
              )}
              <span className="truncate font-medium">
                {email.subject}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {email.direction === "inbound" ? "From" : "To"}:{" "}
              {email.direction === "inbound"
                ? email.from_address.split("<")[0].trim()
                : email.to_address.split("<")[0].trim()}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">
              {timeAgo(email.received_at)}
            </span>
            {email.classification &&
              email.classification !== "unclassified" && (
                <Badge variant="outline" className="text-[10px]">
                  {email.classification.replace("_", " ")}
                </Badge>
              )}
          </div>
        </div>
      ))}
      <Link
        href="/dashboard/emails"
        className="flex items-center justify-center gap-1 py-2 text-xs text-primary hover:underline"
      >
        View in inbox
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}
