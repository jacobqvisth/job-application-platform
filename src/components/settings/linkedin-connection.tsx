"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Loader2, Unplug } from "lucide-react";
import type { LinkedInConnection } from "@/lib/types/database";

interface LinkedInConnectionCardProps {
  connection: LinkedInConnection | null;
}

// LinkedIn logo SVG inline
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function LinkedInConnectionCard({ connection }: LinkedInConnectionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [connecting, setConnecting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("linkedin") === "connected") {
      toast.success("LinkedIn connected successfully!");
    }
    const error = searchParams.get("linkedin");
    if (error === "error") {
      const reason = searchParams.get("reason") ?? "unknown";
      toast.error(`LinkedIn connection failed: ${reason}`);
    }
  }, [searchParams]);

  function handleDisconnect() {
    const confirmed = window.confirm(
      "Are you sure you want to disconnect LinkedIn? You won't be able to share milestones until you reconnect."
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const res = await fetch("/api/linkedin/disconnect", { method: "POST" });
        const data = await res.json();
        if (data.success) {
          toast.success("LinkedIn disconnected");
          // Reload to update server-fetched connection state
          window.location.reload();
        } else {
          toast.error(data.error ?? "Failed to disconnect");
        }
      } catch {
        toast.error("Failed to disconnect LinkedIn");
      }
    });
  }

  if (!connection) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">LinkedIn</p>
          <p className="text-xs text-muted-foreground">
            Connect your LinkedIn account to share milestones with your network
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#0A66C2] hover:bg-[#004182] text-white"
          disabled={connecting}
          onClick={() => {
            setConnecting(true);
            window.location.href = "/api/linkedin/connect";
          }}
        >
          {connecting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LinkedInIcon className="size-4" />
          )}
          {connecting ? "Connecting..." : "Connect LinkedIn"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">LinkedIn</p>
          <p className="text-xs text-muted-foreground">
            {connection.name ?? connection.email ?? "Connected account"}
          </p>
        </div>
        <Badge variant="default" className="gap-1">
          <Check className="size-3" />
          Connected
        </Badge>
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          disabled={isPending}
          className="text-destructive hover:text-destructive"
        >
          <Unplug className="size-4" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}
