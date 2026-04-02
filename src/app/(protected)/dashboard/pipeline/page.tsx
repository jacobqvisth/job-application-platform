import { createClient } from "@/lib/supabase/server";
import { getPipelineData, getPipelineStats } from "@/lib/data/pipeline";
import { getJobEmailSources } from "@/lib/data/job-leads";
import { getPreferences } from "@/lib/jobs/preferences";
import { PipelineClient } from "@/components/pipeline/pipeline-client";

export default async function PipelinePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [items, stats, sources, preferences] = await Promise.all([
    getPipelineData(user.id),
    getPipelineStats(user.id),
    getJobEmailSources(user.id),
    getPreferences(supabase, user.id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Your complete job pipeline — from leads to offers
        </p>
      </div>
      <PipelineClient
        initialItems={items}
        initialStats={stats}
        sources={sources}
        initialPreferences={preferences}
      />
    </div>
  );
}
