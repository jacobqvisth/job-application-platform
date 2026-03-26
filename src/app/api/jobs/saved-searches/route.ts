import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserSavedSearches, createSavedSearch } from '@/lib/data/saved-searches';
import type { CreateSavedSearchData } from '@/lib/types/database';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searches = await getUserSavedSearches(user.id);
  return NextResponse.json({ success: true, searches });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: CreateSavedSearchData;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name || !body.query) {
    return NextResponse.json(
      { error: 'name and query are required' },
      { status: 400 }
    );
  }

  const search = await createSavedSearch(user.id, {
    name: body.name,
    query: body.query,
    location: body.location ?? null,
    remote_only: body.remote_only ?? false,
    salary_min: body.salary_min ?? null,
    country: body.country ?? 'gb',
    is_active: body.is_active ?? true,
  });

  return NextResponse.json({ success: true, search });
}
