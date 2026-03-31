import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { scoreUnscoredJobsForUser } from '@/lib/jobs/ai-score';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scored = await scoreUnscoredJobsForUser(user.id, supabase);
  return NextResponse.json({ scored });
}
