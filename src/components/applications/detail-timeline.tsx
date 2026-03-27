import type { ApplicationEvent, EventType } from "@/lib/types/database";

interface DetailTimelineProps {
  events: ApplicationEvent[];
}

const EVENT_ICONS: Record<EventType, string> = {
  status_change: "🔄",
  email_received: "📧",
  email_sent: "📤",
  note: "📝",
  interview_scheduled: "📅",
  followup_reminder: "🔔",
};

const EVENT_LABELS: Record<EventType, string> = {
  status_change: "Status change",
  email_received: "Email received",
  email_sent: "Email sent",
  note: "Note",
  interview_scheduled: "Interview scheduled",
  followup_reminder: "Follow-up reminder",
};

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DetailTimeline({ events }: DetailTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No events yet — status changes and emails will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm"
        >
          <span className="text-base leading-none mt-0.5">
            {EVENT_ICONS[event.event_type] ?? "•"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                {EVENT_LABELS[event.event_type] ?? event.event_type}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {relativeTime(event.created_at)}
              </span>
            </div>
            {event.description && (
              <p className="mt-0.5 text-sm">{event.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
