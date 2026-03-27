"use client";

import type { WeeklyReviewData } from "@/lib/data/review";
import { ActivityStats } from "./activity-stats";
import { AttentionSection } from "./attention-section";
import { PipelineTable } from "./pipeline-table";
import { InsightCards } from "./insight-cards";
import { ConversionFunnel } from "./conversion-funnel";

interface WeeklyReviewProps {
  data: WeeklyReviewData;
}

export function WeeklyReview({ data }: WeeklyReviewProps) {
  return (
    <div className="space-y-8">
      {/* Section 1: This Week's Activity */}
      <div>
        <h2 className="text-base font-semibold mb-4">This Week&apos;s Activity</h2>
        <ActivityStats data={data} />
      </div>

      {/* Section 2: Needs Attention */}
      <AttentionSection
        followUpQueue={data.followUpQueue}
        staleApplications={data.staleApplications}
      />

      {/* Section 3: Active Pipeline */}
      <PipelineTable applications={data.activeApplications} />

      {/* Section 4: What's Working */}
      <InsightCards data={data} />

      {/* Section 5: Stage Conversion (only if 5+ applied) */}
      {data.totalApplied >= 5 && <ConversionFunnel data={data} />}
    </div>
  );
}
