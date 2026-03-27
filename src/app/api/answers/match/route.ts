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

const RATING_ORDER: Record<string, number> = {
  strong: 0,
  good: 1,
  needs_work: 2,
  untested: 3,
};

const PREDICTED_QUESTION_LABELS: Record<AnswerCategory, string> = {
  behavioral: "Tell me about a time you...",
  technical: "Describe your technical background",
  motivational: "What motivates you?",
  situational: "How would you handle...",
  salary: "What are your salary expectations?",
  availability: "When can you start?",
  why_us: "Why do you want to work here?",
  why_role: "Why are you interested in this role?",
  other: "Additional screening question",
};

type RawAnswer = {
  id: string;
  answer: string;
  rating: string;
  tone: string;
  usage_count: number;
};

type RawQuestion = {
  id: string;
  canonical_text: string;
  category: string;
  screening_answers: RawAnswer[];
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json()) as { jobDescription?: unknown };
  const { jobDescription } = body;

  if (!jobDescription || typeof jobDescription !== "string") {
    return NextResponse.json(
      { error: "jobDescription is required" },
      { status: 400 }
    );
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Step 1: Use Haiku to predict which categories are likely to appear
  let predictedCategories: AnswerCategory[] = [];
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system:
        "You are a job application analyst. Return only valid JSON with no markdown.",
      messages: [
        {
          role: "user",
          content: `Given this job description, list the screening question categories most likely to appear in the application.

Categories: behavioral, technical, motivational, situational, salary, availability, why_us, why_role, other

Job Description:
${jobDescription.slice(0, 2000)}

Return JSON: { "predicted_categories": ["why_role", "behavioral", "technical"] }
Limit to the top 4-5 most likely categories.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        predicted_categories?: unknown;
      };
      if (Array.isArray(parsed.predicted_categories)) {
        predictedCategories = (parsed.predicted_categories as unknown[])
          .filter(
            (c): c is string =>
              typeof c === "string" &&
              VALID_CATEGORIES.includes(c as AnswerCategory)
          )
          .slice(0, 5) as AnswerCategory[];
      }
    }
  } catch {
    // Haiku failed — return empty matches gracefully
    return NextResponse.json({ matches: [] });
  }

  if (predictedCategories.length === 0) {
    return NextResponse.json({ matches: [] });
  }

  // Step 2: Fetch canonical questions + answers for predicted categories
  const { data: questions } = await supabase
    .from("canonical_questions")
    .select("id, canonical_text, category, screening_answers(*)")
    .eq("user_id", user.id)
    .in("category", predictedCategories);

  // Group by category — pick the question with the best-rated answer per category
  const categoryBest = new Map<AnswerCategory, RawQuestion>();

  for (const q of (questions ?? []) as RawQuestion[]) {
    const cat = q.category as AnswerCategory;
    const answers = q.screening_answers ?? [];
    if (answers.length === 0) continue;

    const bestAnswer = [...answers].sort(
      (a, b) =>
        (RATING_ORDER[a.rating] ?? 4) - (RATING_ORDER[b.rating] ?? 4)
    )[0];

    const existing = categoryBest.get(cat);
    if (!existing) {
      categoryBest.set(cat, q);
    } else {
      const existingBest = [...(existing.screening_answers ?? [])].sort(
        (a, b) =>
          (RATING_ORDER[a.rating] ?? 4) - (RATING_ORDER[b.rating] ?? 4)
      )[0];
      if (
        (RATING_ORDER[bestAnswer.rating] ?? 4) <
        (RATING_ORDER[existingBest?.rating ?? ""] ?? 5)
      ) {
        categoryBest.set(cat, q);
      }
    }
  }

  // Build match results for each predicted category
  const matches = predictedCategories.map((category) => {
    const q = categoryBest.get(category);
    if (!q) {
      return {
        predicted_question: PREDICTED_QUESTION_LABELS[category],
        category,
        canonical_question_id: null,
        canonical_text: null,
        best_answer: null,
      };
    }

    const answers = [...(q.screening_answers ?? [])].sort(
      (a, b) =>
        (RATING_ORDER[a.rating] ?? 4) - (RATING_ORDER[b.rating] ?? 4)
    );
    const best = answers[0] ?? null;

    return {
      predicted_question: PREDICTED_QUESTION_LABELS[category],
      category,
      canonical_question_id: q.id,
      canonical_text: q.canonical_text,
      best_answer: best
        ? {
            id: best.id,
            answer_text: best.answer,
            rating: best.rating,
            tone: best.tone,
            usage_count: best.usage_count,
          }
        : null,
    };
  });

  return NextResponse.json({ matches });
}
