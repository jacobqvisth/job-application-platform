"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mail,
  MailOpen,
  RefreshCw,
  XCircle,
  CalendarCheck,
  MessageSquare,
  Gift,
  Inbox,
  HelpCircle,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import type { EmailWithApplication, EmailClassification } from "@/lib/types/database";
import { EmailDetail } from "./email-detail";

const CLASSIFICATION_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  rejection: { label: "Rejection", icon: XCircle, variant: "destructive" },
  interview_invite: { label: "Interview", icon: CalendarCheck, variant: "default" },
  followup: { label: "Follow-up", icon: MessageSquare, variant: "secondary" },
  offer: { label: "Offer", icon: Gift, variant: "default" },
  general: { label: "General", icon: Inbox, variant: "outline" },
  unclassified: { label: "Unclassified", icon: HelpCircle, variant: "outline" },
};

const FILTER_TABS: { value: EmailClassification | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "rejection", label: "Rejections" },
  { value: "interview_invite", label: "Interviews" },
  { value: "followup", label: "Follow-ups" },
  { value: "offer", label: "Offers" },
  { value: "unclassified", label: "Unclassified" },
];

interface EmailListProps {
  emails: EmailWithApplication[];
  lastSyncedAt: string | null;
  stats: Record<string, number>;
}

export function EmailList({ emails, lastSyncedAt, stats }: EmailListProps) {
  const [filter, setFilter] = useState<EmailClassification | "all">("all");
  const [syncing, setSyncing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailWithApplication | null>(null);

  const filteredEmails =
    filter === "all"
      ? emails
      : emails.filter((e) => e.classification === filter);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Synced ${data.synced} emails, classified ${data.classified}`
        );
        window.location.reload();
      } else {
        toast.error(data.error || "Sync failed");
      }
    } catch {
      toast.error("Failed to sync emails");
    } finally {
      setSyncing(false);
    }
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {lastSyncedAt
            ? `Last synced: ${timeAgo(lastSyncedAt)}`
            : "Never synced"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync now"}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? emails.length
              : (stats[tab.value] ?? 0);
          return (
            <Button
              key={tab.value}
              variant={filter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(tab.value)}
            >
              {tab.label}
              {count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 min-w-5 px-1 text-xs"
                >
                  {count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>

      {/* Email List */}
      <div className="divide-y divide-border rounded-lg border">
        {filteredEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Mail className="mb-2 size-8" />
            <p className="text-sm">No emails found</p>
          </div>
        ) : (
          filteredEmails.map((email) => {
            const config =
              CLASSIFICATION_CONFIG[email.classification ?? "unclassified"];
            const Icon = config.icon;

            return (
              <button
                key={email.id}
                onClick={() => setSelectedEmail(email)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                  !email.is_read ? "bg-muted/20" : ""
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {email.is_read ? (
                    <MailOpen className="size-4 text-muted-foreground" />
                  ) : (
                    <Mail className="size-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm ${
                        !email.is_read ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {email.direction === "inbound"
                        ? email.from_address.split("<")[0].trim()
                        : `To: ${email.to_address.split("<")[0].trim()}`}
                    </span>
                    <Badge variant={config.variant} className="shrink-0 text-xs">
                      <Icon className="mr-1 size-3" />
                      {config.label}
                    </Badge>
                    {email.applications && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        <ArrowUpRight className="mr-1 size-3" />
                        {email.applications.company}
                      </Badge>
                    )}
                  </div>
                  <p
                    className={`truncate text-sm ${
                      !email.is_read ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {email.subject}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {email.body_preview?.slice(0, 100)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {timeAgo(email.received_at)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Email Detail */}
      <EmailDetail
        email={selectedEmail}
        open={!!selectedEmail}
        onOpenChange={(open) => !open && setSelectedEmail(null)}
      />
    </div>
  );
}
