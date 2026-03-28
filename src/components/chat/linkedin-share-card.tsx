"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Share2, ExternalLink } from "lucide-react";
import type { LinkedInShareData } from "@/lib/chat/types";

// LinkedIn logo SVG inline
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const MAX_CHARS = 3000;

interface LinkedInShareCardProps {
  data: LinkedInShareData;
}

export function LinkedInShareCard({ data }: LinkedInShareCardProps) {
  const [text, setText] = useState(data.text);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  if (!data.isConnected) {
    return (
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <LinkedInIcon className="size-4 text-[#0A66C2]" />
          <p className="text-sm font-medium">Share this milestone</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Connect your LinkedIn account to share {data.occasion} with your network.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => (window.location.href = "/dashboard/settings")}
        >
          <ExternalLink className="size-3.5" />
          Connect LinkedIn in Settings
        </Button>
      </div>
    );
  }

  if (shared) {
    return (
      <div className="rounded-xl border border-[#0A66C2]/20 bg-[#0A66C2]/5 p-4 flex items-center gap-2">
        <LinkedInIcon className="size-4 text-[#0A66C2]" />
        <p className="text-sm text-[#0A66C2] font-medium">Shared to LinkedIn!</p>
      </div>
    );
  }

  async function handleShare() {
    if (!text.trim()) return;
    setSharing(true);
    try {
      const res = await fetch("/api/linkedin/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const responseData = await res.json();
      if (res.ok && responseData.success) {
        setShared(true);
        toast.success("Shared to LinkedIn!");
      } else {
        toast.error(responseData.error ?? "Failed to share to LinkedIn");
      }
    } catch {
      toast.error("Failed to share to LinkedIn");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <LinkedInIcon className="size-4 text-[#0A66C2]" />
        <p className="text-sm font-medium">Share this milestone on LinkedIn</p>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-[100px] resize-none text-sm"
        maxLength={MAX_CHARS}
      />
      <div className="flex items-center justify-between">
        <p className={`text-xs ${text.length > MAX_CHARS * 0.9 ? "text-amber-500" : "text-muted-foreground"}`}>
          {text.length} / {MAX_CHARS}
        </p>
        <Button
          size="sm"
          className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-1.5"
          onClick={handleShare}
          disabled={sharing || text.trim().length === 0 || text.length > MAX_CHARS}
        >
          {sharing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Share2 className="size-3.5" />
          )}
          {sharing ? "Sharing..." : "Share"}
        </Button>
      </div>
    </div>
  );
}
