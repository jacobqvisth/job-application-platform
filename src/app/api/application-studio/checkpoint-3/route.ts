import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPackage, updatePackage } from '@/lib/data/application-studio';
import type { Checkpoint3Edits } from '@/lib/types/database';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { package_id, edits, save_resume } = (await req.json()) as {
    package_id: string;
    edits?: Checkpoint3Edits;
    save_resume?: boolean;
  };
  if (!package_id) return NextResponse.json({ error: 'package_id required' }, { status: 400 });

  const pkg = await getPackage(supabase, package_id, user.id);
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  if (pkg.status !== 'checkpoint_3') {
    return NextResponse.json(
      { error: `Package is in ${pkg.status} state, expected checkpoint_3` },
      { status: 400 }
    );
  }

  // Apply cover letter edits
  let finalCoverLetter = pkg.generated_cover_letter;
  if (finalCoverLetter && edits?.cover_letter_edits) {
    finalCoverLetter = {
      ...finalCoverLetter,
      text: edits.cover_letter_edits.text,
      word_count: edits.cover_letter_edits.text.split(/\s+/).filter(Boolean).length,
    };
  }

  // Apply screening answer edits
  let finalQuestions = pkg.screening_questions;
  if (finalQuestions && edits?.screening_edits?.length) {
    finalQuestions = finalQuestions.map((q, idx) => {
      const edit = edits.screening_edits!.find((e) => e.question_index === idx);
      return edit ? { ...q, answer: edit.answer } : q;
    });
  }

  // Optionally save resume to resumes table
  let resumeId: string | null = pkg.resume_id;
  if (save_resume && pkg.generated_resume) {
    const jobTitle = pkg.job_analysis?.role_family?.replace(/_/g, ' ') ?? 'Role';
    const company = pkg.company_research?.company_name ?? 'Company';

    const { data: savedResume } = await supabase
      .from('resumes')
      .insert({
        user_id: user.id,
        name: `${jobTitle} — ${company}`,
        content: pkg.generated_resume,
        is_base: false,
      })
      .select('id')
      .single();

    resumeId = savedResume?.id ?? null;
  }

  await updatePackage(supabase, package_id, user.id, {
    checkpoint_3_edits: edits ?? {},
    ...(finalCoverLetter ? { generated_cover_letter: finalCoverLetter } : {}),
    ...(finalQuestions ? { screening_questions: finalQuestions } : {}),
    ...(resumeId ? { resume_id: resumeId } : {}),
    status: 'completed',
  });

  return NextResponse.json({ success: true, resume_id: resumeId });
}
