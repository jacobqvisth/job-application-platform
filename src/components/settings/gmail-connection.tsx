"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, RefreshCw, Unplug } from "lucide-react";
import { disconnectGmailAction } from "@/app/(protected)/dashboard/actions/email-actions";
import type { GmailConnection } from "@/lib/types/database";
import Link from "next/link";

interface GmailConnectionProps {
  connection: GmailConnection | null;
}

export function GmailConnectionCard({ connection }: GmailConnectionProps) {
  const [isPending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("gmail_connected") === "true") {
      toast.success("Gmail connected successfully!");
    }
    const error = searchParams.get("gmail_error");
    if (error) {
      toast.error(`Gmail connection failed: ${error}`);
    }
  }, [searchParams]);

  function handleDisconnect() {
    const confirmed = window.confirm(
      "Are you sure you want to disconnect Gmail? Your synced emails will remain in the app."
    );
    if (!confirmed) return;
    startTransition(async () => {
      const result = await disconnectGmailAction();
      if (result.success) {
        toast.success("Gmail disconnected");
      } else {
        toast.error(result.error ?? "Failed to disconnect");
      }
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Synced ${data.synced} emails, classified ${data.classified}`
        );
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
    if (mins < 60) return `${mins} minute${mins !== 1 ? "s" : ""} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }

  if (!connection) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Gmail</p>
          <p className="text-xs text-muted-foreground">
            Auto-import application emails and track responses
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/api/gmail/connect">Connect</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Gmail</p>
          <p className="text-xs text-muted-foreground">{connection.email}</p>
        </div>
        <Badge variant="default" className="gap-1">
          <Check className="size-3" />
          Connected
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {connection.last_synced_at && (
          <span>Last synced: {timeAgo(connection.last_synced_at)}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing || isPending}
        >
          <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync Now"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={isPending || syncing}
          className="text-destructive hover:text-destructive"
        >
          <Unplug className="size-4" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
