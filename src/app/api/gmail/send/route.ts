import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailClient } from "@/lib/gmail/auth";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { emailId, replyBody, threadId } = await request.json();

  if (!emailId || !replyBody) {
    return NextResponse.json(
      { error: "emailId and replyBody are required" },
      { status: 400 }
    );
  }

  try {
    // Get original email
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("*")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Get Gmail connection for the user's email
    const { data: connection } = await supabase
      .from("gmail_connections")
      .select("email")
      .eq("user_id", user.id)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "Gmail not connected" },
        { status: 400 }
      );
    }

    const gmail = await getGmailClient(user.id);

    // Build RFC 2822 message
    const replyTo = email.from_address;
    const subject = email.subject.startsWith("Re:")
      ? email.subject
      : `Re: ${email.subject}`;

    const messageParts = [
      `From: ${connection.email}`,
      `To: ${replyTo}`,
      `Subject: ${subject}`,
      `In-Reply-To: ${email.gmail_message_id}`,
      `References: ${email.gmail_message_id}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      replyBody,
    ];

    const rawMessage = Buffer.from(messageParts.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const sentMessage = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawMessage,
        threadId: threadId || email.gmail_thread_id,
      },
    });

    // Store the sent email in our database
    await supabase.from("emails").insert({
      user_id: user.id,
      gmail_message_id: sentMessage.data.id!,
      gmail_thread_id: sentMessage.data.threadId!,
      from_address: connection.email,
      to_address: replyTo,
      subject,
      body_preview: replyBody.slice(0, 300),
      body_html: null,
      received_at: new Date().toISOString(),
      direction: "outbound",
      classification: null,
      application_id: email.application_id,
    });

    // Create application event if linked
    if (email.application_id) {
      await supabase.from("application_events").insert({
        application_id: email.application_id,
        event_type: "email_sent",
        description: `Reply sent: ${subject}`,
        metadata: { email_id: emailId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Send email error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
