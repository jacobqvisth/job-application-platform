import { NextRequest, NextResponse } from 'next/server';
import { getExtensionUser } from '@/lib/supabase/extension-auth';

const VALID_STATUSES = ['saved', 'applied', 'interviewing', 'offered', 'rejected'] as const;
type ApplicationStatus = (typeof VALID_STATUSES)[number];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;

  const company = request.nextUrl.searchParams.get('company');
  if (!company || company.trim() === '') {
    return NextResponse.json(
      { error: 'company query param is required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { data: applications, error } = await supabase
    .from('applications')
    .select('id, role, status, updated_at, url')
    .eq('user_id', userId)
    .ilike('company', `%${company}%`)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Extension get-applications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch applications' },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    { success: true, applications: applications ?? [] },
    { headers: CORS_HEADERS }
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await getExtensionUser(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const { userId, supabase } = auth;

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS_HEADERS });
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!body.status || !VALID_STATUSES.includes(body.status as ApplicationStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { error } = await supabase
    .from('applications')
    .update({ status: body.status })
    .eq('id', body.id)
    .eq('user_id', userId);

  if (error) {
    console.error('Extension update-application error:', error);
    return NextResponse.json(
      { error: 'Failed to update application' },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
