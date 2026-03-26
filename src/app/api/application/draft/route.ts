import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data/profile";
import { getUserScreeningAnswers } from "@/lib/data/screening-answers";
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

  const { jobDescription, tone = "formal", resumeId } = await req.json();

  if (!jobDescription) {
    return NextResponse.json(
      { error: "jobDescription is required" },
      { status: 400 }
    );
  }

  // Load profile data and screening answer history in parallel
  const [profile, previousAnswers] = await Promise.all([
    getUserProfile(user.id),
    getUserScreeningAnswers(user.id, 20),
  ]);

  // Build profile context string
  const profileContext = profile
    ? `
CANDIDATE PROFILE:
Summary: ${profile.summary || "Not provided"}

Work History:
${
  (profile.work_history ?? [])
    .map(
      (job) =>
        `- ${job.title} at ${job.company} (${job.startDate} - ${job.endDate || "Present"})
   Bullets: ${job.bullets.join("; ")}`
    )
    .join("\n") || "Not provided"
}

Education:
${
  (profile.education ?? [])
    .map((edu) => `- ${edu.degree} in ${edu.field} from ${edu.institution}`)
    .join("\n") || "Not provided"
}

Skills:
${
  (profile.skills ?? [])
    .map((cat) => `${cat.name}: ${cat.skills.join(", ")}`)
    .join("\n") || "Not provided"
}
`.trim()
    : "CANDIDATE PROFILE: Not yet filled in. Generate a generic application.";

  // Build previous answers context
  const previousAnswersContext =
    previousAnswers.length > 0
      ? `\nPREVIOUS SCREENING ANSWERS (for style/tone reference):\n${previousAnswers
          .slice(0, 10)
          .map((a) => `Q: ${a.question}\nA: ${a.answer}`)
          .join("\n\n")}`
      : "";

  const toneDescription = {
    formal: "professional and formal",
    conversational: "warm and conversational",
    startup: "energetic and startup-friendly",
  }[tone as "formal" | "conversational" | "startup"] ?? "professional and formal";

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system:
      "You are a professional job application assistant. You help candidates craft compelling, authentic application materials based on their background. Always return valid JSON with no markdown code blocks.",
    messages: [
      {
        role: "user",
        content: `Generate a complete job application package for this candidate.

${profileContext}
${previousAnswersContext}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

INSTRUCTIONS:
1. Write a cover letter in a ${toneDescription} tone
2. Infer at least 3 likely screening questions from the job description and write strong answers
3. Detect the company name and role title from the JD
4. Score the candidate's match (0-100) and provide brief notes
5. List the key requirements from the JD

Return ONLY a JSON object (no markdown, no code fences) with this exact structure:
{
  "detected_company": "Company name or Unknown",
  "detected_role": "Role title or Unknown",
  "cover_letter": "Full cover letter text with \\n for line breaks",
  "screening_questions": [
    {
      "question": "Question text",
      "answer": "Answer text",
      "tags": ["tag1", "tag2"]
    }
  ],
  "key_requirements": ["requirement1", "requirement2"],
  "match_score": 75,
  "match_notes": "Brief match analysis"
}`,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return NextResponse.json(
      { error: "Unexpected response from Claude" },
      { status: 500 }
    );
  }

  let draftResult;
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    draftResult = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude's response" },
      { status: 500 }
    );
  }

  // If resumeId provided, also get resume tailoring suggestions
  let resumeSuggestions = undefined;
  if (resumeId) {
    const resume = await getResumeById(resumeId);
    if (resume && resume.user_id === user.id) {
      const summarySection = resume.content.sections.find((s) => s.type === "summary");
      const experienceSection = resume.content.sections.find((s) => s.type === "experience");
      const skillsSection = resume.content.sections.find((s) => s.type === "skills");

      const currentSummary = summarySection
        ? (summarySection.content as SummarySectionContent).text
        : "";
      const currentExperience = experienceSection
        ? JSON.stringify(
            (experienceSection.content as ExperienceSectionContent).items.map((item) => ({
              title: item.title,
              company: item.company,
              bullets: item.bullets,
            }))
          )
        : "[]";
      const currentSkills = skillsSection
        ? JSON.stringify((skillsSection.content as SkillsSectionContent).categories)
        : "[]";

      const tailorResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
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

Only suggest changes that meaningfully improve alignment with the job description. Return only the JSON object.`,
          },
        ],
      });

      const tailorContent = tailorResponse.content[0];
      if (tailorContent.type === "text") {
        try {
          const tailorJsonMatch = tailorContent.text.match(/\{[\s\S]*\}/);
          if (tailorJsonMatch) {
            resumeSuggestions = JSON.parse(tailorJsonMatch[0]);
          }
        } catch {
          // Resume suggestions failed — not critical, continue without
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    detected_company: draftResult.detected_company ?? "Unknown",
    detected_role: draftResult.detected_role ?? "Unknown",
    cover_letter: draftResult.cover_letter ?? "",
    tone,
    screening_questions: draftResult.screening_questions ?? [],
    key_requirements: draftResult.key_requirements ?? [],
    match_score: draftResult.match_score ?? 0,
    match_notes: draftResult.match_notes ?? "",
    ...(resumeSuggestions ? { resume_suggestions: resumeSuggestions } : {}),
  });
}
