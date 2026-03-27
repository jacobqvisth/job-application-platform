import type { WeeklyReviewData } from "@/lib/data/review";

interface ConversionFunnelProps {
  data: WeeklyReviewData;
}

interface FunnelStageProps {
  label: string;
  count: number;
  maxCount: number;
  rate: number | null;
  isFirst?: boolean;
}

function FunnelStage({ label, count, maxCount, rate, isFirst }: FunnelStageProps) {
  const pct = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        <span className="text-xs font-semibold tabular-nums shrink-0">{count}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!isFirst && rate !== null && (
        <p className="mt-1 text-xs text-muted-foreground">{rate}% conversion</p>
      )}
    </div>
  );
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  const { byStatus, conversionByStage, totalApplied } = data;

  const screeningCount = byStatus.screening + byStatus.interview + byStatus.offer;
  const interviewCount = byStatus.interview + byStatus.offer;
  const offerCount = byStatus.offer;

  const stages = [
    { label: "Applied", count: totalApplied, rate: null, isFirst: true },
    { label: "Screening", count: screeningCount, rate: conversionByStage.appliedToScreening },
    { label: "Interview", count: interviewCount, rate: conversionByStage.screeningToInterview },
    { label: "Offer", count: offerCount, rate: conversionByStage.interviewToOffer },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">Stage Conversion</h2>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex gap-4 items-start">
          {stages.map((stage, i) => (
            <div key={stage.label} className="flex items-start gap-2 flex-1 min-w-0">
              <FunnelStage
                label={stage.label}
                count={stage.count}
                maxCount={totalApplied}
                rate={stage.rate}
                isFirst={stage.isFirst}
              />
              {i < stages.length - 1 && (
                <span className="text-muted-foreground/40 text-lg mt-0 shrink-0 leading-5">→</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
