import { createClient } from "@/lib/supabase/server";
import type { ScreeningAnswer, CreateScreeningAnswerData } from "@/lib/types/database";

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
