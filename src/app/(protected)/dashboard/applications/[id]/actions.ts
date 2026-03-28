"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import type { UserProfileData, ExperienceItem, EducationItem, SkillCategory } from "@/lib/types/database";
import { getRelevantKnowledgeContext } from "@/lib/knowledge/get-relevant-knowledge";

const anthropic = new Anthropic();

export async function generatePrepPackAction(applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Fetch application
  const { data: app } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();
  if (!app) throw new Error("Application not found");

  // Fetch profile
  const { data: profile } = await supabase
    .from("user_profile_data")
    .select("work_history, education, skills, summary")
    .eq("user_id", user.id)
    .single();

  const profileContext = buildProfileContext(profile);
  const jobDesc = app.job_description?.trim() || "No job description provided.";
  const knowledgeContext = await getRelevantKnowledgeContext(user.id, app.job_description);

  const systemPrompt = `You are an expert interview coach preparing a candidate for a job interview. Analyze the job description and the candidate's background, then generate a targeted interview prep pack. Return ONLY valid JSON — no markdown, no prose, no explanation. Just the JSON object.`;

  const userPrompt = `Prepare an interview prep pack for this candidate applying for the role of "${app.role}" at "${app.company}".

Candidate profile:
${profileContext}

Job description:
${jobDesc}
${knowledgeContext}

When generating behavioral questions, reference the candidate's actual stories above for the star_prompt hints.

Generate a JSON object with this exact structure:
{
  "company_brief": "2-3 sentence summary of what this company does and what the role involves, based solely on the job description",
  "likely_questions": [
    {
      "category": "behavioral",
      "question": "Tell me about a time when...",
      "star_prompt": "Think about a specific project where you had to..."
    },
    {
      "category": "role-specific",
      "question": "How do you approach...",
      "star_prompt": null
    }
  ],
  "key_themes": [
    "Emphasize your experience with X because the JD mentions Y",
    "..."
  ]
}

Requirements:
- 3-4 behavioral questions (include star_prompt for each — one sentence to jog memory about what kind of experience to think of)
- 4-5 role-specific questions (tied to concrete skills/responsibilities in the JD, star_prompt: null)
- 2-3 motivation/culture questions like "Why this role?" or "What are you looking for?", star_prompt: null, category: "motivation"
- 2-3 technical/domain questions if the JD mentions specific tools, technologies, or methodologies; otherwise skip this category
- 4-6 key_themes: specific, actionable insights about what to emphasize — reference both the JD and the candidate's actual background`;

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: userPrompt }],
    system: systemPrompt,
  });

  const rawText =
    response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: {
    company_brief: string;
    likely_questions: Array<{
      category: string;
      question: string;
      star_prompt: string | null;
    }>;
    key_themes: string[];
  };

  try {
    const jsonText = rawText
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Failed to parse prep pack from AI response");
  }

  const { error } = await supabase.from("interview_prep_packs").upsert(
    {
      user_id: user.id,
      application_id: applicationId,
      company_brief: parsed.company_brief,
      likely_questions: parsed.likely_questions,
      key_themes: parsed.key_themes,
      model_used: "claude-haiku-4-5-20251001",
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "application_id" }
  );

  if (error) throw new Error("Failed to save prep pack");

  revalidatePath(`/dashboard/applications/${applicationId}`);
}

export async function updateApplicationNotesAction(
  id: string,
  notes: string
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("applications")
    .update({ notes: notes || null })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error("Failed to update notes");

  revalidatePath(`/dashboard/applications/${id}`);
}

function buildProfileContext(
  profile: Pick<
    UserProfileData,
    "summary" | "work_history" | "skills" | "education"
  > | null
): string {
  if (!profile) return "No profile data available.";
  const lines: string[] = [];

  if (profile.summary) lines.push(`Summary: ${profile.summary}`);

  if (profile.skills?.length) {
    const allSkills = (profile.skills as SkillCategory[])
      .flatMap((cat) => cat.skills)
      .slice(0, 20);
    if (allSkills.length) lines.push(`Skills: ${allSkills.join(", ")}`);
  }

  if ((profile.work_history as ExperienceItem[])?.length) {
    lines.push("Work history:");
    (profile.work_history as ExperienceItem[]).slice(0, 4).forEach((w) => {
      const duration = w.endDate
        ? `${w.startDate} – ${w.endDate}`
        : `${w.startDate} – present`;
      lines.push(`- ${w.title} at ${w.company} (${duration})`);
      if (w.bullets?.length) {
        w.bullets.slice(0, 2).forEach((b) => lines.push(`  • ${b}`));
      }
    });
  }

  if ((profile.education as EducationItem[])?.length) {
    const eduStr = (profile.education as EducationItem[])
      .map((e) => `${e.degree} from ${e.institution}`)
      .join(", ");
    lines.push(`Education: ${eduStr}`);
  }

  return lines.join("\n") || "No profile data available.";
}
