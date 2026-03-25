import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResumes } from "@/lib/data/resumes";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const resumes = await getResumes(user.id);
    return NextResponse.json({ success: true, resumes });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
