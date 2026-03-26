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
