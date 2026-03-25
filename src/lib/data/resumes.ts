import { createClient } from "@/lib/supabase/server";
import type {
  Resume,
  ResumeWithApplication,
  CreateResumeData,
  UpdateResumeData,
  ResumeContent,
  UserProfileData,
} from "@/lib/types/database";

export async function getResumes(userId: string): Promise<ResumeWithApplication[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("*, applications:tailored_for_application_id(id, company, role)")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ResumeWithApplication[];
}

export async function getResumeById(resumeId: string): Promise<Resume | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", resumeId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Resume;
}

export async function getBaseResume(userId: string): Promise<Resume | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("*")
    .eq("user_id", userId)
    .eq("is_base", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as Resume;
}

export async function createResume(
  userId: string,
  data: CreateResumeData
): Promise<Resume> {
  const supabase = await createClient();
  const { data: resume, error } = await supabase
    .from("resumes")
    .insert({ user_id: userId, ...data })
    .select()
    .single();

  if (error) throw error;
  return resume as Resume;
}

export async function updateResume(
  resumeId: string,
  data: UpdateResumeData
): Promise<Resume> {
  const supabase = await createClient();
  const { data: resume, error } = await supabase
    .from("resumes")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", resumeId)
    .select()
    .single();

  if (error) throw error;
  return resume as Resume;
}

export async function deleteResume(resumeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("resumes").delete().eq("id", resumeId);
  if (error) throw error;
}

export async function duplicateResume(
  resumeId: string,
  newName: string,
  userId: string
): Promise<Resume> {
  const original = await getResumeById(resumeId);
  if (!original) throw new Error("Resume not found");

  return createResume(userId, {
    name: newName,
    content: original.content,
    is_base: false,
    tailored_for_application_id: null,
  });
}

export function buildResumeContentFromProfile(
  profile: UserProfileData | null
): ResumeContent {
  return {
    template: "clean",
    sections: [
      {
        id: crypto.randomUUID(),
        type: "summary",
        title: "Professional Summary",
        visible: true,
        order: 0,
        content: { text: profile?.summary ?? "" },
      },
      {
        id: crypto.randomUUID(),
        type: "experience",
        title: "Work Experience",
        visible: true,
        order: 1,
        content: { items: profile?.work_history ?? [] },
      },
      {
        id: crypto.randomUUID(),
        type: "education",
        title: "Education",
        visible: true,
        order: 2,
        content: { items: profile?.education ?? [] },
      },
      {
        id: crypto.randomUUID(),
        type: "skills",
        title: "Skills",
        visible: true,
        order: 3,
        content: { categories: profile?.skills ?? [] },
      },
      {
        id: crypto.randomUUID(),
        type: "certifications",
        title: "Certifications",
        visible: (profile?.certifications?.length ?? 0) > 0,
        order: 4,
        content: { items: profile?.certifications ?? [] },
      },
      {
        id: crypto.randomUUID(),
        type: "languages",
        title: "Languages",
        visible: (profile?.languages?.length ?? 0) > 0,
        order: 5,
        content: { items: profile?.languages ?? [] },
      },
    ],
  };
}
