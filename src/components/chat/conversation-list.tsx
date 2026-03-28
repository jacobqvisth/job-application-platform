"use client";

import { MessageSquare, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const wks = Math.floor(days / 7);
  return `${wks}w ago`;
}

export interface ConversationSummary {
  id: string;
  title: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
}

interface Props {
  conversations: ConversationSummary[];
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function ConversationList({ conversations, onSelect, onNew }: Props) {
  return (
    <div className="w-full space-y-1">
      <div className="flex items-center justify-between px-1 mb-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Recent conversations
        </p>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs gap-1 px-2"
          onClick={onNew}
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {conversations.map((conv) => (
        <button
          key={conv.id}
          className="w-full flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-left hover:bg-muted/50 transition-colors group"
          onClick={() => onSelect(conv.id)}
        >
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground truncate block">
              {conv.title}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5" />
              {relativeTime(conv.last_message_at)}
              {conv.message_count > 0 && (
                <span className="text-muted-foreground/60">
                  · {conv.message_count} message{conv.message_count !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
