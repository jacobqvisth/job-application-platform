import { createClient } from "@/lib/supabase/server";
import type { UserProfileData } from "@/lib/types/database";

export async function getUserProfile(
  userId: string
): Promise<UserProfileData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_profile_data")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as UserProfileData;
}

export async function updateUserProfile(
  userId: string,
  data: Partial<
    Pick<
      UserProfileData,
      | "summary"
      | "work_history"
      | "education"
      | "skills"
      | "certifications"
      | "languages"
    >
  >
): Promise<UserProfileData> {
  const supabase = await createClient();

  // Upsert: insert if not exists, update if exists
  const { data: profile, error } = await supabase
    .from("user_profile_data")
    .upsert(
      {
        user_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return profile as UserProfileData;
}
