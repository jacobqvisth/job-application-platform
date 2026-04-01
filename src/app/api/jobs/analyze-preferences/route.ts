import { createClient } from '@/lib/supabase/server';
import { analyzeAndSavePreferences } from '@/lib/jobs/preferences';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const prefs = await analyzeAndSavePreferences(supabase, user.id);
    return Response.json({ preferences: prefs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed';
    // Not enough data is a user error, not a server error
    const status = message.includes('Not enough decisions') ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
