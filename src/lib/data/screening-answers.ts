import { createClient } from "@/lib/supabase/server";
import type { ScreeningAnswer } from "@/lib/types/database";

export async function getUserScreeningAnswers(
  userId: string,
  limit = 20
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screening_answers")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}

export async function saveScreeningAnswers(
  userId: string,
  applicationId: string,
  answers: Array<{ question: string; answer: string; tags: string[] }>
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();

  const rows = answers.map((a) => ({
    user_id: userId,
    application_id: applicationId,
    question: a.question,
    answer: a.answer,
    tags: a.tags,
    status: "approved" as const,
  }));

  const { data, error } = await supabase
    .from("screening_answers")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}

export async function getAnswersByApplicationId(
  applicationId: string
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screening_answers")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}

export async function updateScreeningAnswer(
  id: string,
  data: Partial<Pick<ScreeningAnswer, "question" | "answer" | "status" | "tags" | "rating" | "tone" | "canonical_question_id">>
): Promise<ScreeningAnswer> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("screening_answers")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return row as ScreeningAnswer;
}

export async function deleteScreeningAnswer(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("screening_answers")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function searchScreeningAnswers(
  userId: string,
  query: string
): Promise<ScreeningAnswer[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("screening_answers")
    .select("*")
    .eq("user_id", userId)
    .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ScreeningAnswer[];
}

export async function createScreeningAnswer(
  userId: string,
  data: {
    question: string;
    answer: string;
    canonical_question_id?: string;
    application_id?: string;
    tags?: string[];
  }
): Promise<ScreeningAnswer> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("screening_answers")
    .insert({
      user_id: userId,
      question: data.question,
      answer: data.answer,
      canonical_question_id: data.canonical_question_id ?? null,
      application_id: data.application_id ?? null,
      tags: data.tags ?? [],
      status: "approved" as const,
    })
    .select()
    .single();

  if (error) throw error;
  return row as ScreeningAnswer;
}
