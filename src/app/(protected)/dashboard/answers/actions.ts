"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createCanonicalQuestion,
  updateCanonicalQuestion,
  deleteCanonicalQuestion,
  linkAnswerToCanonical,
  updateAnswerRating,
  updateAnswerTone,
} from "@/lib/data/answer-library";
import {
  createScreeningAnswer,
  updateScreeningAnswer,
  deleteScreeningAnswer,
} from "@/lib/data/screening-answers";
import type { AnswerCategory, AnswerRating, AnswerTone } from "@/lib/types/database";

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

async function getAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

export async function createQuestionAction(formData: {
  canonical_text: string;
  category: AnswerCategory;
  tags: string[];
  firstAnswer?: string;
}): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!formData.canonical_text.trim()) {
    throw new Error("Question text is required");
  }

  const question = await createCanonicalQuestion(userId, {
    canonical_text: formData.canonical_text.trim(),
    category: formData.category,
    tags: formData.tags,
  });

  if (formData.firstAnswer?.trim()) {
    await createScreeningAnswer(userId, {
      question: formData.canonical_text.trim(),
      answer: formData.firstAnswer.trim(),
      canonical_question_id: question.id,
    });
  }

  revalidatePath("/dashboard/answers");
}

export async function updateQuestionAction(
  id: string,
  data: { canonical_text?: string; category?: AnswerCategory; tags?: string[] }
): Promise<void> {
  await getAuthenticatedUserId();
  await updateCanonicalQuestion(id, data);
  revalidatePath("/dashboard/answers");
}

export async function deleteQuestionAction(id: string): Promise<void> {
  await getAuthenticatedUserId();
  await deleteCanonicalQuestion(id);
  revalidatePath("/dashboard/answers");
}

export async function createAnswerAction(data: {
  question: string;
  answer: string;
  canonical_question_id: string;
}): Promise<void> {
  const userId = await getAuthenticatedUserId();

  if (!data.answer.trim()) {
    throw new Error("Answer text is required");
  }

  await createScreeningAnswer(userId, {
    question: data.question,
    answer: data.answer.trim(),
    canonical_question_id: data.canonical_question_id,
  });

  revalidatePath("/dashboard/answers");
}

export async function updateAnswerAction(
  id: string,
  data: { answer?: string; rating?: AnswerRating; tone?: AnswerTone }
): Promise<void> {
  await getAuthenticatedUserId();
  await updateScreeningAnswer(id, data);
  revalidatePath("/dashboard/answers");
}

export async function deleteAnswerAction(id: string): Promise<void> {
  await getAuthenticatedUserId();
  await deleteScreeningAnswer(id);
  revalidatePath("/dashboard/answers");
}

export async function linkAnswerAction(
  answerId: string,
  canonicalQuestionId: string
): Promise<void> {
  await getAuthenticatedUserId();
  await linkAnswerToCanonical(answerId, canonicalQuestionId);
  revalidatePath("/dashboard/answers");
}

export async function autoCategorizeAction(questionText: string): Promise<{
  category: AnswerCategory;
  tags: string[];
  confidence: number;
}> {
  await getAuthenticatedUserId();

  if (!questionText.trim()) {
    throw new Error("Question text is required");
  }

  const { Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  const VALID_CATEGORIES: AnswerCategory[] = [
    "behavioral", "technical", "motivational", "situational",
    "salary", "availability", "why_us", "why_role", "other",
  ];

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system:
      "You are a job application question classifier. Given a screening question, classify it into exactly one category and suggest 1-3 relevant tags.\n\nCategories: behavioral, technical, motivational, situational, salary, availability, why_us, why_role, other\n\nRespond in JSON only, no markdown: { \"category\": \"...\", \"tags\": [\"...\"], \"confidence\": 0.0-1.0 }",
    messages: [{ role: "user", content: questionText }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text.trim() : "";

  let parsed: { category?: string; tags?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(text) as { category?: string; tags?: unknown; confidence?: unknown };
  } catch {
    return { category: "other", tags: [], confidence: 0 };
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

  return { category, tags, confidence };
}

export async function updateAnswerRatingAction(
  answerId: string,
  rating: AnswerRating
): Promise<void> {
  await getAuthenticatedUserId();
  await updateAnswerRating(answerId, rating);
  revalidatePath("/dashboard/answers");
}

export async function updateAnswerToneAction(
  answerId: string,
  tone: AnswerTone
): Promise<void> {
  await getAuthenticatedUserId();
  await updateAnswerTone(answerId, tone);
  revalidatePath("/dashboard/answers");
}

/**
 * Background action: link newly saved screening answers to the canonical question library.
 * Called fire-and-forget after saving a draft — does not block the save flow.
 */
export async function linkScreeningAnswersToLibraryAction(
  applicationId: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch all screening answers for this application
  const { data: answers } = await supabase
    .from("screening_answers")
    .select("id, question, answer, canonical_question_id, tags")
    .eq("application_id", applicationId)
    .eq("user_id", user.id);

  if (!answers?.length) return;

  const { Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();

  for (const answer of answers as Array<{
    id: string;
    question: string;
    answer: string;
    canonical_question_id: string | null;
    tags: string[];
  }>) {
    // Skip if already linked to a canonical question
    if (answer.canonical_question_id) continue;

    try {
      // Categorize the question using Haiku
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          "You are a job application question classifier. Classify the question and suggest tags. Return JSON only, no markdown: { \"category\": \"...\", \"tags\": [\"...\"] }",
        messages: [{ role: "user", content: answer.question }],
      });

      const text =
        msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const parsed = jsonMatch
        ? (JSON.parse(jsonMatch[0]) as {
            category?: string;
            tags?: unknown[];
          })
        : {};

      const category = VALID_CATEGORIES.includes(
        parsed.category as AnswerCategory
      )
        ? (parsed.category as AnswerCategory)
        : "other";

      const tags = Array.isArray(parsed.tags)
        ? (parsed.tags as unknown[])
            .filter((t): t is string => typeof t === "string")
            .slice(0, 3)
        : [];

      // Search for a matching canonical question in the same category
      const { data: candidates } = await supabase
        .from("canonical_questions")
        .select("id, canonical_text")
        .eq("user_id", user.id)
        .eq("category", category);

      let matchedId: string | null = null;

      if (candidates?.length) {
        // Simple keyword overlap matching
        const questionWords = answer.question
          .toLowerCase()
          .split(/\W+/)
          .filter((w) => w.length > 3);

        let bestOverlap = 0;
        for (const candidate of candidates as Array<{
          id: string;
          canonical_text: string;
        }>) {
          const candidateWords = candidate.canonical_text
            .toLowerCase()
            .split(/\W+/)
            .filter((w) => w.length > 3);
          const overlap = questionWords.filter((w) =>
            candidateWords.includes(w)
          ).length;
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            matchedId = candidate.id;
          }
        }
        // Require at least 1 meaningful word in common
        if (bestOverlap === 0) matchedId = null;
      }

      if (!matchedId) {
        // No match — create a new canonical question
        const newQuestion = await createCanonicalQuestion(user.id, {
          canonical_text: answer.question,
          category,
          tags,
        });
        matchedId = newQuestion.id;
      }

      if (matchedId) {
        await linkAnswerToCanonical(answer.id, matchedId);
      }
    } catch {
      // Continue processing remaining answers on error
    }
  }
}
