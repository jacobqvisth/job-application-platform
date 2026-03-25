import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResumeById } from "@/lib/data/resumes";
import { generateDocx } from "@/lib/resume/docx-generator";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { resumeId } = await req.json();
    if (!resumeId) {
      return NextResponse.json({ error: "resumeId required" }, { status: 400 });
    }

    const resume = await getResumeById(resumeId);
    if (!resume || resume.user_id !== user.id) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const docxBuffer = await generateDocx(resume.content, resume.name);
    const filename = `${resume.name.replace(/[^a-z0-9]/gi, "_")}.docx`;
    const uint8 = new Uint8Array(docxBuffer);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": uint8.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("DOCX export error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
