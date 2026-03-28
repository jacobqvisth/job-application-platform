"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Share2 } from "lucide-react";

// LinkedIn logo SVG inline
function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

interface LinkedInShareButtonProps {
  defaultText: string;
  isConnected: boolean;
  variant?: "button" | "icon";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const MAX_CHARS = 3000;

export function LinkedInShareButton({
  defaultText,
  isConnected,
  variant = "button",
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: LinkedInShareButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [text, setText] = useState(defaultText);
  const [sharing, setSharing] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function handleOpenChange(value: boolean) {
    if (isControlled) {
      setControlledOpen?.(value);
    } else {
      setInternalOpen(value);
    }
    if (value) {
      // Reset text to default when opening
      setText(defaultText);
    }
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
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Shared to LinkedIn!");
        handleOpenChange(false);
      } else {
        toast.error(data.error ?? "Failed to share to LinkedIn");
      }
    } catch {
      toast.error("Failed to share to LinkedIn");
    } finally {
      setSharing(false);
    }
  }

  if (!isConnected) {
    if (variant === "icon") {
      return (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => (window.location.href = "/dashboard/settings")}
          title="Connect LinkedIn to share"
        >
          <LinkedInIcon className="size-3.5" />
        </Button>
      );
    }
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => (window.location.href = "/dashboard/settings")}
      >
        <LinkedInIcon className="size-3.5" />
        Connect LinkedIn to share
      </Button>
    );
  }

  return (
    <>
      {!isControlled && (
        variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-[#0A66C2]"
            onClick={() => handleOpenChange(true)}
            title="Share on LinkedIn"
          >
            <LinkedInIcon className="size-3.5" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-[#0A66C2]/30 text-[#0A66C2] hover:bg-[#0A66C2]/5"
            onClick={() => handleOpenChange(true)}
          >
            <LinkedInIcon className="size-3.5" />
            Share on LinkedIn
          </Button>
        )
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkedInIcon className="size-4 text-[#0A66C2]" />
              Share on LinkedIn
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What would you like to share?"
              className="min-h-[140px] resize-none text-sm"
              maxLength={MAX_CHARS}
            />
            <p className={`text-right text-xs ${text.length > MAX_CHARS * 0.9 ? "text-amber-500" : "text-muted-foreground"}`}>
              {text.length} / {MAX_CHARS}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={sharing}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#0A66C2] hover:bg-[#004182] text-white gap-1.5"
              onClick={handleShare}
              disabled={sharing || text.trim().length === 0 || text.length > MAX_CHARS}
            >
              {sharing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Share2 className="size-4" />
              )}
              {sharing ? "Sharing..." : "Share"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
