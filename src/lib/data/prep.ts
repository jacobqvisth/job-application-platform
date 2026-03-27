import { createClient } from "@/lib/supabase/server";

export interface PrepQuestion {
  category: "behavioral" | "role-specific" | "motivation" | "technical";
  question: string;
  star_prompt: string | null;
}

export interface PrepPack {
  id: string;
  application_id: string;
  company_brief: string | null;
  likely_questions: PrepQuestion[];
  key_themes: string[];
  generated_at: string;
}

export async function getPrepPack(
  applicationId: string
): Promise<PrepPack | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("interview_prep_packs")
    .select("*")
    .eq("application_id", applicationId)
    .single();
  return data ?? null;
}
