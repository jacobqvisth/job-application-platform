import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { serializeMessage, extractPlainText } from "@/lib/chat/message-serializer";
import type { UIMessage } from "ai";

async function generateTitle(firstUserMessage: string): Promise<string> {
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: "Generate a short conversation title (3-6 words, no quotes). Summarize the user's intent.",
      prompt: firstUserMessage,
      maxOutputTokens: 20,
    });
    return text.trim().replace(/^["']|["']$/g, "") || "New conversation";
  } catch {
    return "New conversation";
  }
}

// POST /api/chat/conversations/[id]/messages — save messages after a turn completes
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401 });

  // Verify ownership and get current message count
  const { data: conv } = await supabase
    .from("chat_conversations")
    .select("id, message_count")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!conv) return new Response("Not found", { status: 404 });

  const body = await req.json().catch(() => ({ messages: [] })) as { messages: UIMessage[] };
  const messages: UIMessage[] = body.messages ?? [];

  if (messages.length === 0) return NextResponse.json({ saved: 0 });

  const rows = messages.map((msg) => ({
    conversation_id: id,
    user_id: user.id,
    role: msg.role,
    content: extractPlainText(msg),
    message_data: serializeMessage(msg),
  }));

  const { error: insertError } = await supabase
    .from("chat_messages")
    .insert(rows);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const newMessageCount = (conv.message_count ?? 0) + messages.length;

  // Auto-generate title on first exchange (first user + first assistant)
  const isFirstExchange = conv.message_count === 0;
  let newTitle: string | undefined;

  if (isFirstExchange) {
    const userMsg = messages.find((m) => m.role === "user");
    if (userMsg) {
      const text = extractPlainText(userMsg);
      if (text) {
        newTitle = await generateTitle(text);
      }
    }
  }

  // Update conversation metadata
  const updatePayload: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
    message_count: newMessageCount,
    updated_at: new Date().toISOString(),
  };
  if (newTitle) updatePayload.title = newTitle;

  await supabase
    .from("chat_conversations")
    .update(updatePayload)
    .eq("id", id);

  return NextResponse.json({ saved: messages.length, title: newTitle });
}
