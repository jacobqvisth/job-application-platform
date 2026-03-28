"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { SearchInsightsResult } from "@/lib/chat/types";

const STAGE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  exploring: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-400" },
  actively_applying: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500" },
  interviewing: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
  negotiating: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
  stalled: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-400" },
};

const STAGE_LABELS: Record<string, string> = {
  exploring: "Exploring",
  actively_applying: "Actively Applying",
  interviewing: "Interviewing",
  negotiating: "Negotiating",
  stalled: "Stalled",
};

const INSIGHT_ICONS: Record<string, string> = {
  trend: "📈",
  pattern: "🔍",
  recommendation: "💡",
  milestone: "🎉",
};

interface Props {
  data: SearchInsightsResult;
  onAppend?: (content: string) => void;
}

export function SearchInsightsCard({ data, onAppend }: Props) {
  const stageStyle = STAGE_STYLES[data.stage.current] ?? STAGE_STYLES.exploring;
  const stageLabel = STAGE_LABELS[data.stage.current] ?? data.stage.current;

  return (
    <Card className="w-full max-w-2xl border border-border">
      <CardContent className="p-4 space-y-4">
        {/* Stage badge + quick stats */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full shrink-0 ${stageStyle.dot}`} />
              <Badge
                variant="secondary"
                className={`text-xs font-semibold ${stageStyle.bg} ${stageStyle.text} border-0`}
              >
                {stageLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground pl-4">{data.stage.reason}</p>
          </div>

          {/* Quick stats */}
          <div className="flex gap-3 shrink-0">
            <div className="text-center">
              <p className="text-sm font-semibold tabular-nums">
                {data.stage.weeklyRate.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">apps/week</p>
            </div>
            {data.stage.daysSinceLastActivity > 0 && (
              <div className="text-center">
                <p className="text-sm font-semibold tabular-nums">
                  {data.stage.daysSinceLastActivity}d
                </p>
                <p className="text-[10px] text-muted-foreground">since active</p>
              </div>
            )}
          </div>
        </div>

        {/* Insights list */}
        {data.insights.length > 0 ? (
          <div className="space-y-2">
            {data.insights.map((insight, i) => (
              <div
                key={i}
                className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5"
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0 mt-0.5">
                    {INSIGHT_ICONS[insight.type] ?? "💡"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-foreground">{insight.title}</p>
                      {insight.metric && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {insight.metric}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {insight.description}
                    </p>
                    {insight.actionable && insight.suggestedAction && onAppend && (
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 mt-1 text-xs font-medium text-[oklch(0.44_0.19_265)]"
                        onClick={() => onAppend(insight.suggestedAction!)}
                      >
                        Take action →
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Not enough data yet — keep applying and insights will appear here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
