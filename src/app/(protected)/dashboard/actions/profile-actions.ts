"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateUserProfile } from "@/lib/data/profile";
import type { UserProfileData } from "@/lib/types/database";

export async function saveProfileAction(
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
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "Not authenticated" };

  try {
    await updateUserProfile(user.id, data);
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard/resumes");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
