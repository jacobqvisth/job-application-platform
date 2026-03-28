import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { isLinkedInPdf, parseLinkedInPdf } from "@/lib/linkedin/parse-linkedin-pdf";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 5MB" },
        { status: 400 }
      );
    }

    // Extract text from PDF using pdf-parse (stay on v1.1.1)
    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const pdfData = await pdfParse(buffer);
    const extractedText: string = pdfData.text;

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract text from PDF" },
        { status: 400 }
      );
    }

    // -----------------------------------------------------------------------
    // LinkedIn PDF path
    // -----------------------------------------------------------------------
    if (isLinkedInPdf(extractedText)) {
      try {
        const linkedInProfile = parseLinkedInPdf(extractedText);

        // Fall back to Claude if the deterministic parser extracted almost nothing
        const tooSparse =
          linkedInProfile.experience.length < 2 &&
          linkedInProfile.education.length < 1;

        if (!tooSparse) {
          return NextResponse.json({
            success: true,
            isLinkedIn: true,
            linkedInProfile,
          });
        }
        // else: fall through to Claude-based parsing below
      } catch {
        // Parsing exception — fall through to Claude
      }
    }

    // -----------------------------------------------------------------------
    // Generic resume path (Claude)
    // -----------------------------------------------------------------------
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Parse this resume text into structured data. Extract:
1. Professional summary
2. Work history (company, title, location, dates, bullet points for each role)
3. Education (institution, degree, field, dates)
4. Skills (categorize into: Technical Skills, Tools & Frameworks, Soft Skills, or other appropriate categories)
5. Certifications (name, issuer, date)
6. Languages (language, proficiency level: native/fluent/advanced/intermediate/basic)

Return as JSON matching this exact structure:
{
  "summary": "...",
  "work_history": [{"id": "uuid", "company": "...", "title": "...", "location": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null", "bullets": ["..."]}],
  "education": [{"id": "uuid", "institution": "...", "degree": "...", "field": "...", "startDate": "YYYY-MM", "endDate": "YYYY-MM or null"}],
  "skills": [{"id": "uuid", "name": "Category Name", "skills": ["skill1", "skill2"]}],
  "certifications": [{"id": "uuid", "name": "...", "issuer": "...", "date": "YYYY-MM"}],
  "languages": [{"id": "uuid", "language": "...", "proficiency": "native|fluent|advanced|intermediate|basic"}]
}

Use short UUID strings for all id fields (e.g. "a1b2c3d4-e5f6-7890-abcd-ef1234567890").
Only return the JSON object, no other text.

Resume text:
${extractedText.slice(0, 8000)}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response from Claude");
    }

    // Parse the JSON response
    let parsed;
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Failed to parse Claude's response as JSON");
    }

    // Ensure all items have IDs
    const ensureId = (item: Record<string, unknown>) =>
      item.id ? item : { ...item, id: crypto.randomUUID() };

    const profile = {
      summary: parsed.summary ?? "",
      work_history: (parsed.work_history ?? []).map(ensureId),
      education: (parsed.education ?? []).map(ensureId),
      skills: (parsed.skills ?? []).map(ensureId),
      certifications: (parsed.certifications ?? []).map(ensureId),
      languages: (parsed.languages ?? []).map(ensureId),
    };

    return NextResponse.json({ success: true, isLinkedIn: false, profile });
  } catch (error) {
    console.error("Resume parse error:", error);
    const message = (error as Error).message || "Failed to parse resume";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
