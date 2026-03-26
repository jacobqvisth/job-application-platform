import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnswerCategory } from "@/lib/types/database";

const VALID_CATEGORIES: AnswerCategory[] = [
  "behavioral",
  "technical",
  "motivational",
  "situational",
  "salary",
  "availability",
  "why_us",
  "why_role",
  "other",
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let question: string;
  try {
    const body = await req.json() as { question?: unknown };
    if (!body.question || typeof body.question !== "string") {
      return NextResponse.json(
        { error: "question is required and must be a string" },
        { status: 400 }
      );
    }
    question = body.question.trim();
    if (!question) {
      return NextResponse.json(
        { error: "question must not be empty" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = new Anthropic();

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "You are a job application question classifier. Given a screening question, classify it into exactly one category and suggest 1-3 relevant tags.\n\nCategories: behavioral, technical, motivational, situational, salary, availability, why_us, why_role, other\n\nRespond in JSON only, no markdown: { \"category\": \"...\", \"tags\": [\"...\"], \"confidence\": 0.0-1.0 }",
    messages: [{ role: "user", content: question }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  let parsed: { category?: string; tags?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(text) as { category?: string; tags?: unknown; confidence?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude response" },
      { status: 500 }
    );
  }

  const category = VALID_CATEGORIES.includes(parsed.category as AnswerCategory)
    ? (parsed.category as AnswerCategory)
    : "other";

  const tags = Array.isArray(parsed.tags)
    ? (parsed.tags as unknown[])
        .filter((t): t is string => typeof t === "string")
        .slice(0, 3)
    : [];

  const confidence =
    typeof parsed.confidence === "number" ? parsed.confidence : 0.5;

  return NextResponse.json({ category, tags, confidence });
}
