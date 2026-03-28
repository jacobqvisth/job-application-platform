"use client";

import { Search, Briefcase, BarChart3, MessageSquare } from "lucide-react";

interface WelcomeData {
  name?: string | null;
  activeApplications: number;
  newJobMatches: number;
  movedForwardThisWeek: number;
}

interface Props {
  data: WelcomeData;
  onSelect: (message: string) => void;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const SUGGESTIONS = [
  { icon: Search, label: "Search for jobs matching my profile" },
  { icon: Briefcase, label: "Show me all my active applications" },
  { icon: BarChart3, label: "Give me my weekly stats" },
  { icon: MessageSquare, label: "Help me prepare for an interview" },
];

export function WelcomeCard({ data, onSelect }: Props) {
  const greeting = getGreeting();
  const nameText = data.name ? `, ${data.name.split(" ")[0]}` : "";

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-6 max-w-lg mx-auto">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] mx-auto flex items-center justify-center shadow-md">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {greeting}{nameText}.
        </h2>
        {data.activeApplications > 0 && (
          <p className="text-sm text-muted-foreground">
            You have{" "}
            <span className="font-medium text-foreground">{data.activeApplications}</span>{" "}
            active application{data.activeApplications !== 1 ? "s" : ""}
            {data.movedForwardThisWeek > 0 ? (
              <> — {data.movedForwardThisWeek} moved forward this week.</>
            ) : (
              "."
            )}
          </p>
        )}
        {data.newJobMatches > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{data.newJobMatches}</span> new job{" "}
            {data.newJobMatches !== 1 ? "matches" : "match"} found from your saved searches.
          </p>
        )}
        <p className="text-sm text-muted-foreground">What would you like to work on?</p>
      </div>

      <div className="w-full space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
          Try asking me to...
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors"
              onClick={() => onSelect(s.label)}
            >
              <s.icon className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs">{s.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
