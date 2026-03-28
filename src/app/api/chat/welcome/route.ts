import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [appsRes, jobsRes, profileRes, eventsRes] = await Promise.all([
    supabase
      .from('applications')
      .select('id, status, applied_at')
      .eq('user_id', user.id),
    supabase
      .from('job_listings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_saved', false),
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single(),
    supabase
      .from('application_events')
      .select('id, created_at, metadata')
      .gte('created_at', sevenDaysAgo.toISOString()),
  ]);

  const apps = appsRes.data ?? [];
  const ACTIVE_STATUSES = new Set(['applied', 'screening', 'interview', 'offer']);
  const FORWARD_STATUSES = new Set(['screening', 'interview', 'offer']);
  const activeApplications = apps.filter((a) => ACTIVE_STATUSES.has(a.status)).length;

  // Count apps that moved forward this week via status_change events
  const movedForwardThisWeek = (eventsRes.data ?? []).filter((e) => {
    const ns = String((e.metadata as Record<string, unknown>)?.new_status ?? '');
    return FORWARD_STATUSES.has(ns);
  }).length;

  return NextResponse.json({
    name: profileRes.data?.full_name ?? user.user_metadata?.full_name ?? null,
    activeApplications,
    newJobMatches: jobsRes.count ?? 0,
    movedForwardThisWeek,
  });
}
