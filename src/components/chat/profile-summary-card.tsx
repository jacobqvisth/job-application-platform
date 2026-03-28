"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfileSummaryData } from "@/lib/chat/types";

interface Props {
  data: ProfileSummaryData;
}

export function ProfileSummaryCard({ data }: Props) {
  const hasData = data.totalKnowledgeItems > 0 || data.strengths.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">
          Your Professional Profile
        </CardTitle>
        {data.currentTitle && (
          <p className="text-xs text-muted-foreground">{data.currentTitle}</p>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Summary */}
        <div>
          <p className="text-xs leading-relaxed text-muted-foreground">{data.summary}</p>
        </div>

        {/* Strengths */}
        {data.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">Key Strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {data.strengths.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Knowledge Completeness */}
        {hasData && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">Knowledge Base</p>
              <span className="text-xs text-muted-foreground">
                {data.totalKnowledgeItems} items
              </span>
            </div>
            <div className="space-y-1.5">
              {data.categories
                .filter((c) => c.count > 0)
                .map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-24 shrink-0 truncate">
                      {cat.name}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60"
                        style={{ width: `${Math.min(100, Math.max(10, cat.completeness || cat.count * 10))}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-6 text-right">{cat.count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {!hasData && (
          <p className="text-xs text-muted-foreground">
            Complete the knowledge interview to build your profile and improve application quality.
          </p>
        )}

        <div className="flex gap-2 pt-1 border-t">
          <Button asChild size="sm" variant="outline" className="text-xs">
            <Link href="/dashboard/knowledge">View full profile →</Link>
          </Button>
          {!hasData && (
            <Button asChild size="sm" className="text-xs">
              <Link href="/dashboard/knowledge/interview">Start interview</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
