import { createClient } from '@/lib/supabase/server';
import { markJobListingAsApplied } from '@/lib/jobs/dedup';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { jobListingId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { jobListingId } = body;
  if (!jobListingId) {
    return Response.json({ error: 'jobListingId is required' }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from('job_listings')
    .select('id, company, title, url, source, has_applied, application_id, description')
    .eq('id', jobListingId)
    .eq('user_id', user.id)
    .single();

  if (listingError || !listing) {
    return Response.json({ error: 'Job listing not found' }, { status: 404 });
  }

  // Idempotency: already applied
  if (listing.has_applied && listing.application_id) {
    return Response.json({
      applicationId: listing.application_id,
      url: listing.url,
      company: listing.company,
      role: listing.title,
      alreadyExists: true,
    });
  }

  const { data: newApp, error: appError } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      company: listing.company,
      role: listing.title,
      url: listing.url,
      status: 'applied',
      applied_at: new Date().toISOString(),
      job_description: listing.description ?? null,
      notes: `Started from job lead · Source: ${listing.source}`,
      job_listing_id: listing.id,
    })
    .select('id')
    .single();

  if (appError || !newApp) {
    return Response.json({ error: 'Failed to create application' }, { status: 500 });
  }

  await markJobListingAsApplied(supabase, listing.id, newApp.id);

  return Response.json({
    applicationId: newApp.id,
    url: listing.url,
    company: listing.company,
    role: listing.title,
    alreadyExists: false,
  });
}
