import { createClient } from "@/lib/supabase/server";
import { getJobLeads, getJobLeadStats, getJobEmailSources } from "@/lib/data/job-leads";
import { JobLeadsClient } from "@/components/job-leads/job-leads-client";

export default async function JobLeadsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [leads, stats, sources] = await Promise.all([
    getJobLeads(user.id, { limit: 100 }),
    getJobLeadStats(user.id),
    getJobEmailSources(user.id),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Job Leads</h1>
        <p className="text-sm text-muted-foreground">
          Your curated shortlist of jobs to apply to
        </p>
      </div>
      <JobLeadsClient
        initialLeads={leads}
        initialStats={stats}
        sources={sources}
      />
    </div>
  );
}
