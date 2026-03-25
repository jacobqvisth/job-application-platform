import { gmail_v1 } from "googleapis";
import { getGmailClient } from "./auth";
import { createClient } from "@/lib/supabase/server";

interface ParsedEmail {
  gmail_message_id: string;
  gmail_thread_id: string;
  from_address: string;
  to_address: string;
  subject: string;
  body_preview: string | null;
  body_html: string | null;
  received_at: string;
  direction: "inbound" | "outbound";
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(
  payload: gmail_v1.Schema$MessagePart | undefined
): { html: string | null; text: string | null } {
  if (!payload) return { html: null, text: null };

  let html: string | null = null;
  let text: string | null = null;

  if (payload.mimeType === "text/html" && payload.body?.data) {
    html = decodeBase64Url(payload.body.data);
  } else if (payload.mimeType === "text/plain" && payload.body?.data) {
    text = decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result.html) html = result.html;
      if (result.text && !text) text = result.text;
    }
  }

  return { html, text };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGmailMessage(
  message: gmail_v1.Schema$Message,
  userEmail: string
): ParsedEmail {
  const headers = message.payload?.headers;
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const subject = getHeader(headers, "Subject");
  const date = getHeader(headers, "Date");

  const { html, text } = extractBody(message.payload);
  const bodyText = text || (html ? stripHtml(html) : null);
  const preview = bodyText ? bodyText.slice(0, 300) : null;

  // Determine direction based on whether user's email is in the From field
  const fromLower = from.toLowerCase();
  const direction = fromLower.includes(userEmail.toLowerCase())
    ? "outbound"
    : "inbound";

  return {
    gmail_message_id: message.id!,
    gmail_thread_id: message.threadId!,
    from_address: from,
    to_address: to,
    subject: subject || "(no subject)",
    body_preview: preview,
    body_html: html,
    received_at: date
      ? new Date(date).toISOString()
      : new Date(Number(message.internalDate)).toISOString(),
    direction,
  };
}

export async function syncEmails(userId: string): Promise<number> {
  const supabase = await createClient();
  const gmail = await getGmailClient(userId);

  // Get connection details
  const { data: connection } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!connection) throw new Error("Gmail not connected");

  const userEmail = connection.email;
  let newEmailCount = 0;

  if (connection.sync_cursor) {
    // Incremental sync using History API
    try {
      const historyResponse = await gmail.users.history.list({
        userId: "me",
        startHistoryId: connection.sync_cursor,
        historyTypes: ["messageAdded"],
      });

      const messageIds = new Set<string>();
      for (const history of historyResponse.data.history ?? []) {
        for (const added of history.messagesAdded ?? []) {
          if (added.message?.id) {
            messageIds.add(added.message.id);
          }
        }
      }

      for (const messageId of messageIds) {
        const fetched = await fetchAndStoreMessage(
          gmail,
          supabase,
          messageId,
          userId,
          userEmail
        );
        if (fetched) newEmailCount++;
      }

      // Update cursor
      if (historyResponse.data.historyId) {
        await supabase
          .from("gmail_connections")
          .update({
            sync_cursor: historyResponse.data.historyId,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      }
    } catch (error: unknown) {
      // If history is too old, fall back to full sync
      const err = error as { code?: number };
      if (err.code === 404) {
        return fullSync(gmail, supabase, userId, userEmail, connection.id);
      }
      throw error;
    }
  } else {
    // First-time full sync
    newEmailCount = await fullSync(
      gmail,
      supabase,
      userId,
      userEmail,
      connection.id
    );
  }

  return newEmailCount;
}

async function fullSync(
  gmail: gmail_v1.Gmail,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  userEmail: string,
  connectionId: string
): Promise<number> {
  // Get messages from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const after = Math.floor(thirtyDaysAgo.getTime() / 1000);

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    q: `after:${after}`,
    maxResults: 200,
  });

  let newEmailCount = 0;
  for (const msg of listResponse.data.messages ?? []) {
    if (!msg.id) continue;
    const fetched = await fetchAndStoreMessage(
      gmail,
      supabase,
      msg.id,
      userId,
      userEmail
    );
    if (fetched) newEmailCount++;
  }

  // Get current historyId for future incremental syncs
  const profile = await gmail.users.getProfile({ userId: "me" });
  await supabase
    .from("gmail_connections")
    .update({
      sync_cursor: profile.data.historyId?.toString(),
      last_synced_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return newEmailCount;
}

async function fetchAndStoreMessage(
  gmail: gmail_v1.Gmail,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  messageId: string,
  userId: string,
  userEmail: string
): Promise<boolean> {
  // Check if already stored
  const { data: existing } = await supabase
    .from("emails")
    .select("id")
    .eq("gmail_message_id", messageId)
    .single();

  if (existing) return false;

  try {
    const msgResponse = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const parsed = parseGmailMessage(msgResponse.data, userEmail);

    const { error } = await supabase.from("emails").insert({
      user_id: userId,
      ...parsed,
      classification: "unclassified",
    });

    if (error) {
      // Skip duplicate key errors
      if (error.code === "23505") return false;
      console.error("Error storing email:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error fetching message ${messageId}:`, error);
    return false;
  }
}
