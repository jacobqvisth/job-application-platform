"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createResume,
  deleteResume,
  duplicateResume,
  updateResume,
  buildResumeContentFromProfile,
} from "@/lib/data/resumes";
import { getUserProfile } from "@/lib/data/profile";
import type { UpdateResumeData } from "@/lib/types/database";

export async function createResumeFromProfileAction(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    const profile = await getUserProfile(user.id);
    const content = buildResumeContentFromProfile(profile);
    const resume = await createResume(user.id, {
      name,
      content,
      is_base: true,
    });
    revalidatePath("/dashboard/resumes");
    return { success: true, resumeId: resume.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createBlankResumeAction(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    const content = buildResumeContentFromProfile(null);
    const resume = await createResume(user.id, {
      name,
      content,
      is_base: false,
    });
    revalidatePath("/dashboard/resumes");
    return { success: true, resumeId: resume.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateResumeAction(
  resumeId: string,
  data: UpdateResumeData
) {
  try {
    const resume = await updateResume(resumeId, data);
    revalidatePath("/dashboard/resumes");
    revalidatePath(`/dashboard/resumes/${resumeId}`);
    return { success: true, resume };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteResumeAction(resumeId: string) {
  try {
    await deleteResume(resumeId);
    revalidatePath("/dashboard/resumes");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function duplicateResumeAction(
  resumeId: string,
  newName: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  try {
    const resume = await duplicateResume(resumeId, newName, user.id);
    revalidatePath("/dashboard/resumes");
    return { success: true, resumeId: resume.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
