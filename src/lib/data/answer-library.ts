import { createClient } from "@/lib/supabase/server";
import type {
  CanonicalQuestion,
  CanonicalQuestionWithAnswers,
  ScreeningAnswer,
  AnswerCategory,
  AnswerRating,
  AnswerTone,
  LibraryOverview,
} from "@/lib/types/database";

export async function getCanonicalQuestions(
  userId: string,
  filters?: { category?: string; search?: string }
): Promise<CanonicalQuestion[]> {
  const supabase = await createClient();
  let query = supabase
    .from("canonical_questions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters?.category && filters.category !== "all") {
    query = query.eq("category", filters.category);
  }
  if (filters?.search) {
    query = query.ilike("canonical_text", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CanonicalQuestion[];
}

export async function getCanonicalQuestionsWithAnswers(
  userId: string
): Promise<CanonicalQuestionWithAnswers[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canonical_questions")
    .select("*, screening_answers(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CanonicalQuestionWithAnswers[];
}

export async function createCanonicalQuestion(
  userId: string,
  data: { canonical_text: string; category: AnswerCategory; tags?: string[] }
): Promise<CanonicalQuestion> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("canonical_questions")
    .insert({
      user_id: userId,
      canonical_text: data.canonical_text,
      category: data.category,
      tags: data.tags ?? [],
    })
    .select()
    .single();

  if (error) throw error;
  return row as CanonicalQuestion;
}

export async function updateCanonicalQuestion(
  id: string,
  data: Partial<Pick<CanonicalQuestion, "canonical_text" | "category" | "tags">>
): Promise<CanonicalQuestion> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("canonical_questions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return row as CanonicalQuestion;
}

export async function deleteCanonicalQuestion(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("canonical_questions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function getAnswersByCanonical(
  canonicalQuestionId: string
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screening_answers")
    .select("*")
    .eq("canonical_question_id", canonicalQuestionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}

export async function linkAnswerToCanonical(
  answerId: string,
  canonicalQuestionId: string
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("screening_answers")
    .update({
      canonical_question_id: canonicalQuestionId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", answerId);

  if (error) throw error;
}

export async function updateAnswerRating(
  answerId: string,
  rating: AnswerRating
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("screening_answers")
    .update({ rating, updated_at: new Date().toISOString() })
    .eq("id", answerId);

  if (error) throw error;
}

export async function updateAnswerTone(
  answerId: string,
  tone: AnswerTone
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("screening_answers")
    .update({ tone, updated_at: new Date().toISOString() })
    .eq("id", answerId);

  if (error) throw error;
}

export async function incrementUsageCount(answerId: string): Promise<void> {
  const supabase = await createClient();
  // Use rpc for atomic increment, fallback to read-then-write
  const { data: current, error: fetchError } = await supabase
    .from("screening_answers")
    .select("usage_count")
    .eq("id", answerId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from("screening_answers")
    .update({
      usage_count: (current?.usage_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", answerId);

  if (error) throw error;
}

export async function getLibraryOverview(
  userId: string
): Promise<LibraryOverview> {
  const questions = await getCanonicalQuestionsWithAnswers(userId);

  const byCategory: Record<string, number> = {};
  let totalAnswers = 0;
  let strongAnswers = 0;
  let needsWorkAnswers = 0;

  for (const q of questions) {
    byCategory[q.category] = (byCategory[q.category] ?? 0) + 1;
    for (const a of q.screening_answers) {
      totalAnswers++;
      if (a.rating === "strong") strongAnswers++;
      if (a.rating === "needs_work") needsWorkAnswers++;
    }
  }

  return {
    totalQuestions: questions.length,
    totalAnswers,
    byCategory,
    strongAnswers,
    needsWorkAnswers,
  };
}

export async function getOrphanAnswers(
  userId: string
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screening_answers")
    .select("*")
    .eq("user_id", userId)
    .is("canonical_question_id", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}
