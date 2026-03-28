import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/chat/conversations — list conversations for the current user
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, title, last_message_at, message_count, created_at")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("last_message_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// POST /api/chat/conversations — create a new conversation
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title as string) || "New conversation";

  const { data, error } = await supabase
    .from("chat_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, last_message_at, message_count, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
