import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { emailId, tone = "professional" } = await request.json();

  if (!emailId) {
    return NextResponse.json(
      { error: "emailId is required" },
      { status: 400 }
    );
  }

  try {
    // Fetch the email with linked application
    const { data: email, error: emailError } = await supabase
      .from("emails")
      .select("*, applications(id, company, role, status)")
      .eq("id", emailId)
      .single();

    if (emailError || !email) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Build context
    const application = email.applications;
    let contextStr = "";
    if (application) {
      contextStr = `
Context:
- Company: ${application.company}
- Role: ${application.role}
- Application status: ${application.status}`;
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `Draft a reply to this email about a job application.
${contextStr}
- Email classification: ${email.classification}

Original email:
Subject: ${email.subject}
From: ${email.from_address}
Body: ${(email.body_preview ?? "").slice(0, 1000)}

Instructions:
- Tone: ${tone}
- Be concise and professional
- If it's an interview invite, express enthusiasm and ask about scheduling details
- If it's a rejection, thank them gracefully
- If it's a follow-up, respond helpfully

Draft the reply email body only (no subject line, no greeting like "Dear..."). Start directly with the content.`,
        },
      ],
    });

    const content = response.content[0];
    const draft = content.type === "text" ? content.text : "";

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error("Draft reply error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
