import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    interactionType?: string;
    actionText?: string;
    actionMessage?: string;
    toolName?: string;
    conversationId?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { interactionType, actionText, actionMessage, toolName, conversationId, metadata } = body;

  const validTypes = ['suggestion_click', 'chip_click', 'morning_brief_action', 'tool_invocation'];
  if (!interactionType || !validTypes.includes(interactionType)) {
    return NextResponse.json({ error: 'Invalid interaction_type' }, { status: 400 });
  }

  const { error } = await supabase.from('chat_interactions').insert({
    user_id: user.id,
    conversation_id: conversationId ?? null,
    interaction_type: interactionType,
    action_text: actionText ?? null,
    action_message: actionMessage ?? null,
    tool_name: toolName ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    return NextResponse.json({ error: 'Failed to save interaction' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') ?? '30', 10);
  const type = url.searchParams.get('type');

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('chat_interactions')
    .select('interaction_type, action_text, tool_name, created_at')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (type) {
    query = query.eq('interaction_type', type);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch interactions' }, { status: 500 });
  }

  return NextResponse.json({ interactions: data ?? [] });
}
