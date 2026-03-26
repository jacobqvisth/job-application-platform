import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markJobListingSaved } from '@/lib/data/job-listings';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    title: string;
    company: string;
    url: string;
    location?: string;
    description?: string;
    salary_min?: number;
    salary_max?: number;
    remote_type?: 'remote' | 'hybrid' | 'onsite' | 'unknown';
    external_id?: string;
    source?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.title || !body.company || !body.url) {
    return NextResponse.json(
      { error: 'title, company, and url are required' },
      { status: 400 }
    );
  }

  // Check for existing application with same URL
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', user.id)
    .eq('url', body.url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      success: true,
      applicationId: existing.id,
      alreadySaved: true,
    });
  }

  // Build salary_range string
  let salaryRange: string | null = null;
  if (body.salary_min && body.salary_max) {
    salaryRange = `${body.salary_min}–${body.salary_max}`;
  } else if (body.salary_min) {
    salaryRange = `${body.salary_min}+`;
  }

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      user_id: user.id,
      company: body.company,
      role: body.title,
      url: body.url,
      status: 'saved',
      job_description: body.description ?? null,
      location: body.location ?? null,
      remote_type:
        body.remote_type && body.remote_type !== 'unknown' ? body.remote_type : null,
      salary_range: salaryRange,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to save application:', error);
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500 });
  }

  // Mark job listing as saved if it came from cron cache
  if (body.external_id && body.source) {
    await markJobListingSaved(user.id, body.external_id, body.source).catch(() => {
      // Non-critical — listing may not be in cache
    });
  }

  return NextResponse.json({
    success: true,
    applicationId: application.id,
    alreadySaved: false,
  });
}
