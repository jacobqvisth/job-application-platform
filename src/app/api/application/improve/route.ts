import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { type, content, instruction, jobDescription, question } = await req.json();

  if (!type || !content || !instruction || !jobDescription) {
    return NextResponse.json(
      { error: "type, content, instruction, and jobDescription are required" },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt =
    type === "cover_letter"
      ? `You are a professional job application writer. Improve the following cover letter based on the user's instruction.

Job Description Context:
${jobDescription.slice(0, 1500)}

Current Cover Letter:
${content}

User's Instruction: ${instruction}

Return ONLY the improved cover letter text, with no preamble, no explanation, and no quotes. Preserve paragraph breaks using \\n.`
      : `You are a professional job application writer. Improve the following screening question answer based on the user's instruction.

Job Description Context:
${jobDescription.slice(0, 1500)}

Question: ${question || ""}

Current Answer:
${content}

User's Instruction: ${instruction}

Return ONLY the improved answer text, with no preamble, no explanation, and no quotes.`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const result = response.content[0];
  if (result.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected response from Claude" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, improved: result.text.trim() });
}
