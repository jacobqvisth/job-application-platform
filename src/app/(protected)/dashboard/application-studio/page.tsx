import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ApplicationStudioClient } from '@/components/application-studio/studio-client';

export default async function ApplicationStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; package?: string }>;
}) {
  const { job: jobId, package: packageId } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let initialJob = null;
  let initialPackage = null;

  if (packageId) {
    // Resume existing package
    const { data } = await supabase
      .from('application_packages')
      .select('*, job_listings(id, title, company, location, description, url, remote_type, match_score, ats_type, required_skills)')
      .eq('id', packageId)
      .eq('user_id', user.id)
      .single();
    if (!data) redirect('/dashboard/chat');
    initialPackage = data;
    initialJob = data.job_listings;
  } else if (jobId) {
    // Start new — fetch the job listing
    const { data } = await supabase
      .from('job_listings')
      .select('id, title, company, location, description, url, remote_type, match_score, ats_type, required_skills')
      .eq('id', jobId)
      .single();
    if (!data) redirect('/dashboard/chat');
    initialJob = data;

    // Check if there's already a non-completed package for this job
    const { data: existing } = await supabase
      .from('application_packages')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('job_listing_id', jobId)
      .not('status', 'in', '("completed","abandoned")')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (existing?.[0]) {
      initialPackage = { id: existing[0].id, status: existing[0].status };
    }
  } else {
    // No job or package specified — redirect
    redirect('/dashboard/chat');
  }

  return (
    <ApplicationStudioClient
      initialJob={initialJob}
      initialPackage={initialPackage}
    />
  );
}
