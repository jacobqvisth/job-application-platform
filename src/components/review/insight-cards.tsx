import Link from "next/link";
import type { WeeklyReviewData } from "@/lib/data/review";
import { cn } from "@/lib/utils";

interface InsightCardsProps {
  data: WeeklyReviewData;
}

interface InsightCardProps {
  tone: "green" | "amber" | "blue";
  title: string;
  body: string;
  linkHref?: string;
  linkLabel?: string;
}

function InsightCard({ tone, title, body, linkHref, linkLabel }: InsightCardProps) {
  const borderColor = {
    green: "border-l-emerald-500",
    amber: "border-l-amber-500",
    blue: "border-l-blue-500",
  }[tone];

  const dotColor = {
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    blue: "bg-blue-500",
  }[tone];

  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm border-l-4", borderColor)}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotColor)} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
          {linkHref && linkLabel && (
            <Link
              href={linkHref}
              className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
            >
              {linkLabel} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function InsightCards({ data }: InsightCardsProps) {
  const { responseRate, avgDaysToResponse, topPerformingFilters, answerLibraryStats } = data;

  const insights: InsightCardProps[] = [];

  // 1. Response Rate
  if (responseRate === null) {
    insights.push({
      tone: "blue",
      title: "Response Rate",
      body: "Start applying to see your response rate. Aim for 20–30% as a healthy baseline.",
      linkHref: "/dashboard/applications",
      linkLabel: "Go to Applications",
    });
  } else {
    const tone: InsightCardProps["tone"] =
      responseRate >= 30 ? "green" : "amber";
    const context =
      responseRate >= 30
        ? "Great work — you're converting well above average."
        : responseRate >= 15
        ? "Solid foundation. Tailoring your applications further could push this higher."
        : "Room to improve. Try tailoring cover letters and using your Answer Library for screening calls.";
    insights.push({
      tone,
      title: `Response Rate: ${responseRate}%${avgDaysToResponse !== null ? ` · avg ${avgDaysToResponse}d to hear back` : ""}`,
      body: context,
    });
  }

  // 2. Best performing segment
  const bestRemote = topPerformingFilters.byRemoteType[0];
  const bestLocation = topPerformingFilters.byLocation[0];

  if (bestRemote) {
    const label =
      bestRemote.remoteType.charAt(0).toUpperCase() + bestRemote.remoteType.slice(1);
    insights.push({
      tone: "blue",
      title: "Best Performing Segment",
      body: `${label} roles convert at ${bestRemote.responseRate}% — your best segment (${bestRemote.count} applications).`,
    });
  } else if (bestLocation) {
    insights.push({
      tone: "blue",
      title: "Best Performing Location",
      body: `${bestLocation.location} converts at ${bestLocation.responseRate}% — your best location (${bestLocation.count} applications).`,
    });
  }

  // 3. Answer Library
  const { totalQuestions, strongAnswers, needsWorkAnswers } = answerLibraryStats;
  if (totalQuestions === 0) {
    insights.push({
      tone: "blue",
      title: "Answer Library is empty",
      body: "Build your Answer Library to reuse great answers across applications and screening calls.",
      linkHref: "/dashboard/answers",
      linkLabel: "Go to Answer Library",
    });
  } else if (needsWorkAnswers > 0) {
    insights.push({
      tone: "amber",
      title: "Answer Library needs attention",
      body: `You have ${needsWorkAnswers} answer${needsWorkAnswers > 1 ? "s" : ""} marked 'needs work'. Refining them could sharpen your screening performance.`,
      linkHref: "/dashboard/answers",
      linkLabel: "Update answers",
    });
  } else {
    insights.push({
      tone: "green",
      title: "Answer Library is healthy",
      body: `${strongAnswers} strong answer${strongAnswers !== 1 ? "s" : ""} across ${totalQuestions} question type${totalQuestions !== 1 ? "s" : ""} — well prepared for screening calls.`,
      linkHref: "/dashboard/answers",
      linkLabel: "View library",
    });
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-4">What&apos;s Working</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {insights.map((insight, i) => (
          <InsightCard key={i} {...insight} />
        ))}
      </div>
    </div>
  );
}
