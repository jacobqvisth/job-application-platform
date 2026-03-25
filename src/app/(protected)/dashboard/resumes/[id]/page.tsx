import { createClient } from "@/lib/supabase/server";
import { getResumeById } from "@/lib/data/resumes";
import { notFound } from "next/navigation";
import { ResumeEditor } from "./resume-editor";

export default async function ResumeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const resume = await getResumeById(id);

  if (!resume || resume.user_id !== user.id) {
    notFound();
  }

  return <ResumeEditor resume={resume} />;
}
