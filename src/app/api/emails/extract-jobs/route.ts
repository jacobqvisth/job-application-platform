import { createClient } from '@/lib/supabase/server';
import { extractJobsFromEmail } from '@/lib/jobs/extract-from-email';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { emailId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { emailId } = body;
  if (!emailId) {
    return Response.json({ error: 'emailId is required' }, { status: 400 });
  }

  // Verify email ownership
  const { data: emailCheck, error: emailError } = await supabase
    .from('emails')
    .select('id')
    .eq('id', emailId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (emailError || !emailCheck) {
    return Response.json({ error: 'Email not found' }, { status: 404 });
  }

  // Idempotency: check for already-extracted listings
  const { data: existingListings } = await supabase
    .from('job_listings')
    .select('id, title, company, location, url, has_applied, lead_status')
    .eq('source_email_id', emailId)
    .eq('user_id', user.id);

  if (existingListings && existingListings.length > 0) {
    return Response.json({
      extracted: existingListings.map((l: {
        id: string;
        title: string;
        company: string;
        location: string | null;
        url: string;
        has_applied: boolean;
      }) => ({
        jobListingId: l.id,
        title: l.title,
        company: l.company,
        location: l.location,
        url: l.url,
        isNew: false,
        alreadyApplied: l.has_applied,
      })),
      newCount: 0,
      duplicateCount: existingListings.length,
      alreadyExtracted: true,
    });
  }

  // Delegate core extraction to shared utility
  let result;
  try {
    result = await extractJobsFromEmail(supabase, emailId, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extraction failed';
    return Response.json({ error: `Extraction failed: ${message}` }, { status: 500 });
  }

  // Fetch extracted listings for the response
  const { data: listings } = result.extractedIds.length > 0
    ? await supabase
        .from('job_listings')
        .select('id, title, company, location, url, has_applied, lead_status')
        .in('id', result.extractedIds)
    : { data: [] };

  const extracted = (listings ?? []).map((l: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    url: string | null;
    has_applied: boolean;
    lead_status: string | null;
  }) => ({
    jobListingId: l.id,
    title: l.title,
    company: l.company,
    location: l.location,
    url: l.url,
    isNew: true,
    alreadyApplied: l.has_applied,
  }));

  return Response.json({
    extracted,
    newCount: result.newCount,
    duplicateCount: result.duplicateCount,
    alreadyExtracted: false,
  });
}
