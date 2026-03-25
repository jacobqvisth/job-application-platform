import { createClient } from "@/lib/supabase/server";
import { getResumes } from "@/lib/data/resumes";
import { getUserProfile } from "@/lib/data/profile";
import { ResumesList } from "./resumes-list";

export default async function ResumesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [resumes, profile] = await Promise.all([
    getResumes(user.id),
    getUserProfile(user.id),
  ]);

  const hasProfile =
    profile !== null &&
    ((profile.work_history?.length ?? 0) > 0 ||
      (profile.education?.length ?? 0) > 0 ||
      (profile.skills?.length ?? 0) > 0 ||
      !!profile.summary);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resumes</h1>
          <p className="text-sm text-muted-foreground">
            {resumes.length > 0
              ? `${resumes.length} resume${resumes.length !== 1 ? "s" : ""}`
              : "Create and manage your resumes"}
          </p>
        </div>
      </div>
      <ResumesList resumes={resumes} hasProfile={hasProfile} />
    </div>
  );
}
