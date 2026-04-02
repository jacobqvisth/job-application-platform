import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/supabase/extension-auth';
import { findOrCreateJobListing, markJobListingAsApplied } from '@/lib/jobs/dedup';
import type { JobSource } from '@/lib/jobs/dedup';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function atsTypeToSource(
  atsType: string | undefined
): JobSource {
  switch (atsType) {
    case 'workday':    return 'workday';
    case 'greenhouse': return 'greenhouse';
    case 'lever':      return 'lever';
    case 'linkedin':   return 'linkedin';
    case 'teamtailor': return 'teamtailor';
    case 'varbi':      return 'varbi';
    case 'jobylon':    return 'jobylon';
    case 'reachmee':   return 'reachmee';
    default:           return 'manual';
  }
}

export async function POST(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;

  let body: {
    title: string;
    company: string;
    url: string;
    location?: string;
    description?: string;
    ats_type?: 'workday' | 'greenhouse' | 'lever' | 'linkedin' | 'teamtailor' | 'varbi' | 'jobylon' | 'reachmee' | 'unknown';
    status?: 'saved' | 'applied' | 'interviewing' | 'offered' | 'rejected';
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
  }

  if (!body.title || !body.company || !body.url) {
    return NextResponse.json(
      { error: 'title, company, and url are required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const source = atsTypeToSource(body.ats_type);

  // Find or create canonical job listing (dedup by fingerprint)
  let dedupResult;
  try {
    dedupResult = await findOrCreateJobListing(supabase, {
      userId,
      title: body.title,
      company: body.company,
      url: body.url,
      source,
      description: body.description,
      location: body.location,
    });
  } catch (err) {
    console.error('Extension save-job dedup error:', err);
    return NextResponse.json({ error: 'Failed to process job' }, { status: 500, headers: CORS_HEADERS });
  }

  // If already applied — return early with warning
  if (dedupResult.alreadyApplied) {
    return NextResponse.json(
      {
        success: true,
        applicationId: dedupResult.applicationId,
        jobListingId: dedupResult.jobListingId,
        alreadySaved: true,
        alreadyApplied: true,
        appliedAt: dedupResult.appliedAt,
        warningMessage: dedupResult.warningMessage,
      },
      { headers: CORS_HEADERS }
    );
  }

  // If already saved (seen from another source) — check if there's an existing application
  if (!dedupResult.isNew && dedupResult.applicationId) {
    return NextResponse.json(
      {
        success: true,
        applicationId: dedupResult.applicationId,
        jobListingId: dedupResult.jobListingId,
        alreadySaved: true,
        alreadyApplied: false,
        warningMessage: dedupResult.warningMessage,
      },
      { headers: CORS_HEADERS }
    );
  }

  // Check for an existing application linked to this job listing
  if (!dedupResult.isNew) {
    const { data: existingApp } = await supabase
      .from('applications')
      .select('id')
      .eq('user_id', userId)
      .eq('job_listing_id', dedupResult.jobListingId)
      .maybeSingle();

    if (existingApp) {
      return NextResponse.json(
        {
          success: true,
          applicationId: existingApp.id,
          jobListingId: dedupResult.jobListingId,
          alreadySaved: true,
          alreadyApplied: false,
          warningMessage: dedupResult.warningMessage,
        },
        { headers: CORS_HEADERS }
      );
    }
  }

  // Create application
  const applicationStatus = body.status ?? 'saved';
  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      company: body.company,
      role: body.title,
      url: body.url,
      status: applicationStatus,
      job_description: body.description ?? null,
      location: body.location ?? null,
      job_listing_id: dedupResult.jobListingId,
      ...(body.notes ? { notes: body.notes } : {}),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Extension save-job error:', error);
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500, headers: CORS_HEADERS });
  }

  // Mark listing as applied if status is applied
  if (applicationStatus === 'applied') {
    await markJobListingAsApplied(supabase, dedupResult.jobListingId, application.id);
  } else {
    // Still link the application back even if not yet applied
    await supabase
      .from('job_listings')
      .update({ is_saved: true, application_id: application.id })
      .eq('id', dedupResult.jobListingId);
  }

  return NextResponse.json(
    { success: true, applicationId: application.id, jobListingId: dedupResult.jobListingId, alreadySaved: false },
    { headers: CORS_HEADERS }
  );
}
