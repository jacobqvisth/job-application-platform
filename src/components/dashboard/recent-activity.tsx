import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ApplicationEvent, Application } from "@/lib/types/database";
import {
  ArrowRightLeft,
  Mail,
  Send,
  StickyNote,
  Calendar,
  Bell,
} from "lucide-react";

type EventWithApplication = ApplicationEvent & {
  applications: Pick<Application, "company" | "role">;
};

const eventIcons: Record<string, React.ElementType> = {
  status_change: ArrowRightLeft,
  email_received: Mail,
  email_sent: Send,
  note: StickyNote,
  interview_scheduled: Calendar,
  followup_reminder: Bell,
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface RecentActivityProps {
  events: EventWithApplication[];
}

export function RecentActivity({ events }: RecentActivityProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activity yet. Start by adding your first application!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => {
          const Icon = eventIcons[event.event_type] || StickyNote;
          return (
            <div key={event.id} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">
                    {event.applications?.company}
                  </span>
                  {" - "}
                  <span className="text-muted-foreground">
                    {event.applications?.role}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {event.description}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelativeTime(event.created_at)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
