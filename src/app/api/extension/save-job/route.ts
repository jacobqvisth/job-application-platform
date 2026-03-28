import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/supabase/extension-auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
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
    ats_type?: 'workday' | 'greenhouse' | 'lever' | 'linkedin' | 'unknown';
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

  // Check for duplicate
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('user_id', userId)
    .eq('url', body.url)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { success: true, applicationId: existing.id, alreadySaved: true },
      { headers: CORS_HEADERS }
    );
  }

  const { data: application, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      company: body.company,
      role: body.title,
      url: body.url,
      status: body.status ?? 'saved',
      job_description: body.description ?? null,
      location: body.location ?? null,
      ...(body.notes ? { notes: body.notes } : {}),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Extension save-job error:', error);
    return NextResponse.json({ error: 'Failed to save job' }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    { success: true, applicationId: application.id, alreadySaved: false },
    { headers: CORS_HEADERS }
  );
}
