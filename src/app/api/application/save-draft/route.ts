import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createApplication, updateApplication } from "@/lib/data/applications";
import { saveScreeningAnswers } from "@/lib/data/screening-answers";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    company,
    role,
    jobDescription,
    coverLetter,
    screeningAnswers,
    applicationId,
    url,
    location,
    remoteType,
    markAsApplied,
  } = await req.json();

  if (!company || !role) {
    return NextResponse.json(
      { error: "company and role are required" },
      { status: 400 }
    );
  }

  const status = markAsApplied ? "applied" : "saved";

  let savedApplicationId: string;

  if (applicationId) {
    // Update existing application
    const updated = await updateApplication(supabase, applicationId, {
      cover_letter: coverLetter,
      job_description: jobDescription,
      status,
      ...(markAsApplied ? { applied_at: new Date().toISOString() } : {}),
    });
    savedApplicationId = updated.id;
  } else {
    // Create new application, then attach cover_letter via update
    const created = await createApplication(supabase, {
      company,
      role,
      status,
      url: url || null,
      location: location || null,
      remote_type: remoteType || null,
      job_description: jobDescription || null,
      salary_range: null,
      contact_name: null,
      contact_email: null,
      notes: null,
    });
    savedApplicationId = created.id;

    // Attach cover letter separately (not part of CreateApplicationData)
    if (coverLetter) {
      await updateApplication(supabase, savedApplicationId, {
        cover_letter: coverLetter,
      });
    }
  }

  // Save screening answers
  if (screeningAnswers?.length > 0) {
    await saveScreeningAnswers(user.id, savedApplicationId, screeningAnswers);
  }

  return NextResponse.json({ success: true, applicationId: savedApplicationId });
}
