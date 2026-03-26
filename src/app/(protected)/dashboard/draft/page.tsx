import { createClient } from "@/lib/supabase/server";
import { getResumes } from "@/lib/data/resumes";
import { DraftWizard } from "@/components/draft/draft-wizard";

interface DraftPageProps {
  searchParams: Promise<{
    company?: string;
    role?: string;
    jobDescription?: string;
  }>;
}

export default async function DraftPage({ searchParams }: DraftPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const params = await searchParams;
  const resumes = await getResumes(user.id);
  const resumeList = resumes.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div>
      <DraftWizard
        resumes={resumeList}
        initialJobDescription={params.jobDescription}
        initialCompany={params.company}
        initialRole={params.role}
      />
    </div>
  );
}
