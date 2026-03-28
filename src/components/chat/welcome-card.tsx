"use client";

import { useEffect, useState } from "react";
import { Search, Briefcase, BarChart3, MessageSquare, ChevronRight } from "lucide-react";
import { MorningBrief } from "./morning-brief";
import { ConversationList } from "./conversation-list";
import type { MorningBriefData } from "@/lib/chat/morning-brief";
import type { ConversationSummary } from "./conversation-list";

const LAST_VISIT_KEY = "nexus-last-visit";
const MORNING_BRIEF_THRESHOLD_MS = 8 * 60 * 60 * 1000; // 8 hours

interface WelcomeData {
  name?: string | null;
  activeApplications: number;
  newJobMatches: number;
  movedForwardThisWeek: number;
}

interface Props {
  data: WelcomeData;
  conversations?: ConversationSummary[];
  onSelect: (message: string) => void;
  onSelectConversation?: (id: string) => void;
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

const MAX_RECENT = 5;

export function WelcomeCard({ data, conversations = [], onSelect, onSelectConversation }: Props) {
  const [briefData, setBriefData] = useState<MorningBriefData | null>(null);
  const [showBrief, setShowBrief] = useState(false);

  useEffect(() => {
    // Update last visit timestamp
    const lastVisitStr = localStorage.getItem(LAST_VISIT_KEY);
    const now = Date.now();
    const lastVisit = lastVisitStr ? parseInt(lastVisitStr, 10) : 0;
    const hoursSinceVisit = now - lastVisit;

    // Show morning brief if: has applications AND been 8+ hours since last visit
    const shouldShowBrief =
      data.activeApplications > 0 && hoursSinceVisit > MORNING_BRIEF_THRESHOLD_MS;

    if (shouldShowBrief) {
      fetch("/api/chat/morning-brief")
        .then((res) => (res.ok ? res.json() : null))
        .then((briefJson: MorningBriefData | null) => {
          if (briefJson) {
            setBriefData(briefJson);
            setShowBrief(true);
          }
        })
        .catch(() => {
          // Fall back to regular welcome card
        });
    }

    // Update last visit
    localStorage.setItem(LAST_VISIT_KEY, String(now));
  }, [data.activeApplications]);

  const handleSelect = (message: string) => {
    setShowBrief(false);
    onSelect(message);
  };

  if (showBrief && briefData) {
    return <MorningBrief data={briefData} onSelect={handleSelect} />;
  }

  const greeting = getGreeting();
  const nameText = data.name ? `, ${data.name.split(" ")[0]}` : "";
  const recentConversations = conversations.slice(0, MAX_RECENT);
  const hasMore = conversations.length > MAX_RECENT;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center space-y-6 max-w-lg mx-auto">
      <div className="space-y-2">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[oklch(0.44_0.19_265)] to-[oklch(0.62_0.16_240)] mx-auto flex items-center justify-center shadow-md">
          <MessageSquare className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight" suppressHydrationWarning>
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

      {/* Recent conversations */}
      {recentConversations.length > 0 && onSelectConversation && (
        <div className="w-full">
          <ConversationList
            conversations={recentConversations}
            onSelect={onSelectConversation}
            onNew={() => {/* already on welcome screen */}}
          />
          {hasMore && (
            <button
              className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
              onClick={() => {
                // Show full list — for now just show all inline
                // Future: navigate to /dashboard/chat?list=1
              }}
            >
              View all {conversations.length} conversations
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
