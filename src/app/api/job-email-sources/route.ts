import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('job_email_sources')
    .select('*')
    .eq('user_id', user.id)
    .order('total_extracted', { ascending: false });

  if (error) {
    return Response.json({ error: 'Failed to fetch email sources' }, { status: 500 });
  }

  return Response.json({ sources: data });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    senderEmail?: string;
    senderDomain?: string;
    displayName?: string;
    isAutoExtract?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { senderEmail, senderDomain, displayName, isAutoExtract } = body;
  if (!senderEmail || !senderDomain || !displayName) {
    return Response.json(
      { error: 'senderEmail, senderDomain, and displayName are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('job_email_sources')
    .upsert(
      {
        user_id: user.id,
        sender_email: senderEmail,
        sender_domain: senderDomain,
        display_name: displayName,
        is_auto_extract: isAutoExtract ?? false,
      },
      { onConflict: 'user_id,sender_email' }
    )
    .select()
    .single();

  if (error) {
    return Response.json({ error: 'Failed to save email source' }, { status: 500 });
  }

  return Response.json({ source: data });
}
