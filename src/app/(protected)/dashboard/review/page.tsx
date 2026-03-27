import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getWeeklyReviewData } from "@/lib/data/review";
import { WeeklyReview } from "@/components/review/weekly-review";

export const metadata: Metadata = {
  title: "Weekly Review | Job Platform",
  description: "Your weekly job search summary",
};

export default async function ReviewPage() {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    redirect("/login");
  }

  const data = await getWeeklyReviewData(authData.user.id);

  const weekStart = new Date(data.period.start).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const weekEnd = new Date(data.period.end).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Weekly Review</h1>
        <p className="text-sm text-muted-foreground">
          {weekStart} – {weekEnd} · Your job search at a glance
        </p>
      </div>
      <WeeklyReview data={data} />
    </div>
  );
}
