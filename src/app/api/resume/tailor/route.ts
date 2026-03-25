import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResumeById } from "@/lib/data/resumes";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ExperienceSectionContent,
  SkillsSectionContent,
  SummarySectionContent,
} from "@/lib/types/database";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { resumeId, jobDescription, applicationId } = await req.json();

    if (!resumeId || !jobDescription) {
      return NextResponse.json(
        { error: "resumeId and jobDescription required" },
        { status: 400 }
      );
    }

    const resume = await getResumeById(resumeId);
    if (!resume || resume.user_id !== user.id) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    // Extract current summary and experience bullets for context
    const summarySection = resume.content.sections.find(
      (s) => s.type === "summary"
    );
    const experienceSection = resume.content.sections.find(
      (s) => s.type === "experience"
    );
    const skillsSection = resume.content.sections.find(
      (s) => s.type === "skills"
    );

    const currentSummary = summarySection
      ? (summarySection.content as SummarySectionContent).text
      : "";
    const currentExperience = experienceSection
      ? JSON.stringify(
          (experienceSection.content as ExperienceSectionContent).items.map(
            (item) => ({
              title: item.title,
              company: item.company,
              bullets: item.bullets,
            })
          )
        )
      : "[]";
    const currentSkills = skillsSection
      ? JSON.stringify(
          (skillsSection.content as SkillsSectionContent).categories
        )
      : "[]";

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a professional resume writer. Tailor this resume for the job description below.

Current resume summary:
${currentSummary}

Current work experience bullets (JSON):
${currentExperience}

Current skills (JSON):
${currentSkills}

Job Description:
${jobDescription.slice(0, 3000)}

Provide specific suggestions to tailor this resume. Return a JSON object with:
{
  "summary": {
    "original": "...",
    "suggested": "...",
    "reason": "..."
  },
  "experience_bullets": [
    {
      "jobIndex": 0,
      "bulletIndex": 0,
      "original": "...",
      "suggested": "...",
      "reason": "..."
    }
  ],
  "skills_reorder": {
    "suggested_order": ["category1", "category2"],
    "reason": "..."
  },
  "keywords_to_add": ["keyword1", "keyword2"]
}

Only suggest changes that meaningfully improve alignment with the job description. Keep suggestions authentic and based on the actual experience listed. Return only the JSON object.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response from Claude");
    }

    let suggestions;
    try {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error("Failed to parse Claude's response");
    }

    return NextResponse.json({
      success: true,
      suggestions,
      resumeId,
      applicationId: applicationId ?? null,
    });
  } catch (error) {
    console.error("Resume tailor error:", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
