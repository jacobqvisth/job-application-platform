import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { deserializeMessage } from "@/lib/chat/message-serializer";

// GET /api/chat/conversations/[id] — load all messages for a conversation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  // Verify ownership
  const { data: conv } = await supabase
    .from("chat_conversations")
    .select("id, title, last_message_at, message_count, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conv) return new Response("Not found", { status: 404 });

  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("message_data, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const uiMessages = (messages ?? []).map((row) =>
    deserializeMessage(row.message_data as Record<string, unknown>)
  );

  return NextResponse.json({ conversation: conv, messages: uiMessages });
}

// PATCH /api/chat/conversations/[id] — update title or archived state
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") updates.title = body.title;
  if (typeof body.is_archived === "boolean") updates.is_archived = body.is_archived;

  const { data, error } = await supabase
    .from("chat_conversations")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, last_message_at, message_count, is_archived, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return new Response("Not found", { status: 404 });

  return NextResponse.json(data);
}

// DELETE /api/chat/conversations/[id] — delete conversation (cascades to messages)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const { error } = await supabase
    .from("chat_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
