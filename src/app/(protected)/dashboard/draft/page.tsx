import { createClient } from "@/lib/supabase/server";
import { getResumes } from "@/lib/data/resumes";
import { DraftWizard } from "@/components/draft/draft-wizard";

export default async function DraftPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const resumes = await getResumes(user.id);
  const resumeList = resumes.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <DraftWizard resumes={resumeList} />
    </div>
  );
}
