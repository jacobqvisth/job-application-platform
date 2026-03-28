"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronLeft, TrendingUp, Bell, BarChart3, Lightbulb, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { onChatToolExecuted } from "@/lib/chat/chat-events";
import type { ContextSidebarPayload } from "@/app/api/context-sidebar/route";

const STATUS_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-700",
  applied: "bg-blue-100 text-blue-700",
  screening: "bg-yellow-100 text-yellow-700",
  interview: "bg-purple-100 text-purple-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_ORDER = ["applied", "screening", "interview", "offer", "saved", "rejected"];

export function ContextSidebar() {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [data, setData] = useState<ContextSidebarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/context-sidebar");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail — sidebar data is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  // Load persisted collapse state
  useEffect(() => {
    const saved = localStorage.getItem("nexus-sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(fetchData, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // Refresh after chat tool executes
  useEffect(() => {
    return onChatToolExecuted(fetchData);
  }, [fetchData]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("nexus-sidebar-collapsed", String(next));
  };

  const askNexus = (message: string) => {
    router.push(`/dashboard/chat?ask=${encodeURIComponent(message)}`);
  };

  const handleSuggestionClick = (action: string) => askNexus(action);
  const handlePipelineClick = (status: string) =>
    askNexus(`Show me my ${status} applications`);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-l border-border bg-card transition-all duration-200 shrink-0 relative h-screen sticky top-0",
        collapsed ? "w-0 border-l-0 overflow-hidden" : "w-72"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={toggleCollapsed}
        className={cn(
          "absolute -left-3 top-16 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors",
          collapsed && "-left-8"
        )}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronLeft className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>

      {!collapsed && (
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Header */}
          <div className="flex h-14 items-center px-4 border-b border-border shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Context
            </p>
          </div>

          <div className="flex flex-col gap-3 p-3 flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Pipeline Summary */}
                <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <TrendingUp className="h-3 w-3" />
                    Your Pipeline
                  </div>
                  {data && data.pipeline.total > 0 ? (
                    <div className="flex flex-col gap-1">
                      {STATUS_ORDER.filter((s) => (data.pipeline[s as keyof typeof data.pipeline] as number) > 0).map((status) => {
                        const count = data.pipeline[status as keyof typeof data.pipeline] as number;
                        if (count === 0) return null;
                        return (
                          <button
                            key={status}
                            onClick={() => handlePipelineClick(status)}
                            className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-muted/50 transition-colors text-left w-full group"
                          >
                            <span className="text-xs text-muted-foreground capitalize group-hover:text-foreground transition-colors">
                              {status}
                            </span>
                            <span
                              className={cn(
                                "text-xs font-semibold px-1.5 py-0.5 rounded-full",
                                STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
                              )}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No applications yet</p>
                  )}
                </div>

                {/* Recent Activity */}
                {data && data.recentActivity.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <Bell className="h-3 w-3" />
                      Recent Activity
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {data.recentActivity.slice(0, 5).map((event) => (
                        <div key={event.id} className="flex items-start gap-2">
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs leading-tight truncate">
                              {event.company && (
                                <span className="font-medium">{event.company} </span>
                              )}
                              <span className="text-muted-foreground">
                                {event.description ?? event.eventType.replace(/_/g, " ")}
                              </span>
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              {event.relativeTime}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* This Week */}
                {data && (
                  <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <BarChart3 className="h-3 w-3" />
                      This Week
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Applied</span>
                        <span className="text-xs font-semibold">{data.stats.appliedThisWeek}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Responses</span>
                        <span className="text-xs font-semibold">{data.stats.responsesThisWeek}</span>
                      </div>
                      {data.stats.responseRate !== null && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Response rate</span>
                          <span
                            className={cn(
                              "text-xs font-semibold",
                              data.stats.responseRate > 20
                                ? "text-green-600"
                                : data.stats.responseRate > 10
                                  ? "text-yellow-600"
                                  : "text-muted-foreground"
                            )}
                          >
                            {data.stats.responseRate}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Suggested Action */}
                {data && data.suggestions.length > 0 && (
                  <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      <Lightbulb className="h-3 w-3" />
                      Suggested
                    </div>
                    <p className="text-xs text-foreground leading-snug">
                      {data.suggestions[0].text}
                    </p>
                    <button
                      onClick={() => handleSuggestionClick(data.suggestions[0].action)}
                      className="text-xs font-medium text-[oklch(0.44_0.19_265)] hover:underline"
                    >
                      Ask Nexus →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
