import {
  ArrowRightLeft,
  Mail,
  Send,
  StickyNote,
  Calendar,
  Bell,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ApplicationEvent } from "@/lib/types/database";
import type { EventType } from "@/lib/types/database";

function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
  if (diffMonths === 1) return "1 month ago";
  return `${diffMonths} months ago`;
}

const eventConfig: Record<
  EventType,
  { icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  status_change: { icon: ArrowRightLeft, label: "Status Change" },
  email_received: { icon: Mail, label: "Email Received" },
  email_sent: { icon: Send, label: "Email Sent" },
  note: { icon: StickyNote, label: "Note" },
  interview_scheduled: { icon: Calendar, label: "Interview Scheduled" },
  followup_reminder: { icon: Bell, label: "Follow-up Reminder" },
};

interface ApplicationTimelineProps {
  events: ApplicationEvent[];
}

export function ApplicationTimeline({ events }: ApplicationTimelineProps) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No activity yet
      </p>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="relative space-y-0">
      {sorted.map((event, index) => {
        const config = eventConfig[event.event_type];
        const Icon = config.icon;
        const isLast = index === sorted.length - 1;

        return (
          <div key={event.id} className="relative flex gap-4 pb-6">
            {/* Vertical line */}
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}

            {/* Icon circle */}
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{config.label}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
              {event.description && (
                <p className="mt-1 text-sm text-foreground">
                  {event.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
