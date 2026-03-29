import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/data/profile";
import { getCanonicalQuestionsWithAnswers } from "@/lib/data/answer-library";
import { getRelevantKnowledgeContext } from "@/lib/knowledge/get-relevant-knowledge";
import { getResumeById } from "@/lib/data/resumes";
import Anthropic from "@anthropic-ai/sdk";
import type {
  ExperienceSectionContent,
  SkillsSectionContent,
  SummarySectionContent,
} from "@/lib/types/database";

const RATING_ORDER: Record<string, number> = {
  strong: 0,
  good: 1,
  needs_work: 2,
  untested: 3,
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    jobDescription,
    tone = "formal",
    resumeId,
    pinnedAnswers = {},
    language,
  } = (await req.json()) as {
    jobDescription?: string;
    tone?: string;
    resumeId?: string;
    pinnedAnswers?: Record<string, string>;
    language?: "sv" | "en";
  };

  if (!jobDescription) {
    return NextResponse.json(
      { error: "jobDescription is required" },
      { status: 400 }
    );
  }

  // Load profile, library, and knowledge context in parallel
  const [profile, canonicalQuestions, knowledgeContext] = await Promise.all([
    getUserProfile(user.id),
    getCanonicalQuestionsWithAnswers(user.id),
    getRelevantKnowledgeContext(user.id, jobDescription),
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

  // Build structured library context from canonical questions with good/strong answers
  const goodAnswers = canonicalQuestions
    .filter((q) =>
      q.screening_answers.some(
        (a) => a.rating === "strong" || a.rating === "good"
      )
    )
    .map((q) => ({
      category: q.category,
      canonical_text: q.canonical_text,
      best_answer: [...q.screening_answers].sort(
        (a, b) =>
          (RATING_ORDER[a.rating] ?? 4) - (RATING_ORDER[b.rating] ?? 4)
      )[0]?.answer ?? "",
    }));

  const libraryContext =
    goodAnswers.length > 0
      ? `\nANSWER LIBRARY (candidate's best answers by category):\n${goodAnswers
          .map(
            (a) =>
              `[${a.category.toUpperCase()}] "${a.canonical_text}"\nBest answer: ${a.best_answer}`
          )
          .join("\n\n")}`
      : "";

  const pinnedEntries = Object.entries(pinnedAnswers);
  const pinnedContext =
    pinnedEntries.length > 0
      ? `\nPINNED ANSWERS (use these VERBATIM for matching questions, set pinned: true):\n${pinnedEntries
          .map(([q, a]) => `Q: ${q}\nA: ${a}`)
          .join("\n\n")}`
      : "";

  // Auto-detect Swedish if not specified
  const SWEDISH_KEYWORDS = [
    "vi söker", "arbetsuppgifter", "kvalifikationer", "anställning",
    "tjänst", "arbetsgivare", "arbetstagare", "lön", "ansökan",
    "meriterande", "erfarenhet av", "vi erbjuder", "om oss",
  ];
  const jdLower = jobDescription.toLowerCase();
  const isSwedish =
    language === "sv" ||
    (language !== "en" &&
      SWEDISH_KEYWORDS.filter((kw) => jdLower.includes(kw)).length >= 2);

  const toneDescription = isSwedish
    ? ({
        formal: "formellt och professionellt",
        conversational: "personligt och varmt men professionellt",
        startup: "informellt och startup-vänligt",
      }[tone as "formal" | "conversational" | "startup"] ??
      "formellt och professionellt")
    : ({
        formal: "professional and formal",
        conversational: "warm and conversational",
        startup: "energetic and startup-friendly",
      }[tone as "formal" | "conversational" | "startup"] ??
      "professional and formal");

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const coverLetterInstruction = isSwedish
    ? `1. Skriv ett PERSONLIGT BREV på svenska (INTE ett amerikanskt cover letter):
   - Det ska vara personligt och reflekterande, inte bara en sammanfattning av CV:t
   - Skriv i första person med en varm men professionell ton (${toneDescription})
   - Besvara: Vem är jag? Varför detta företag? Varför denna roll? Vad kan jag bidra med?
   - Längd: ca 250-400 ord (ungefär en halv till en hel A4-sida)
   - Börja INTE med "Jag söker tjänsten som..." — det är för formellt och tråkigt
   - Börja istället med något som visar genuin motivation eller en relevant koppling
   - Avsluta med en mening om att du ser fram emot att berätta mer på en intervju
   - Undvik överdrivna superlativer och självförhärligande — svensk arbetskultur värderar laganda och ödmjukhet
   - Om rekryterarens namn finns i annonsen, adressera brevet till hen
   - FORMAT: Börja med "[Stad], [dagens datum]", sedan "[Tilltalande]", sedan brödtext i 3-4 stycken, sedan avslutning`
    : `1. Write a cover letter in a ${toneDescription} tone`;

  const screeningInstruction = isSwedish
    ? "2. Härleda minst 3 sannolika screeningfrågor från platsannonsen och skriv starka svar på svenska"
    : "2. Infer at least 3 likely screening questions from the job description and write strong answers";

  const systemPrompt = isSwedish
    ? "Du är en professionell jobbansökningsassistent för den svenska arbetsmarknaden. Du hjälper kandidater att skapa övertygande och autentiska ansökningsmaterial baserat på deras bakgrund. Returnera alltid giltig JSON utan markdown-kodblock."
    : "You are a professional job application assistant. You help candidates craft compelling, authentic application materials based on their background. Always return valid JSON with no markdown code blocks.";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Generate a complete job application package for this candidate.

${profileContext}
${libraryContext}
${pinnedContext}
${knowledgeContext}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

INSTRUCTIONS:
${coverLetterInstruction}
${screeningInstruction}
3. Detect the company name and role title from the JD
4. Score the candidate's match (0-100) and provide brief notes
5. List the key requirements from the JD
6. For screening questions that match the PINNED ANSWERS — use that answer verbatim and set "pinned": true
7. For other questions — use the ANSWER LIBRARY as style/tone/content reference (do NOT copy verbatim), set "pinned": false
8. If no library or pinned context is provided, generate fresh answers; set all "pinned": false

Return ONLY a JSON object (no markdown, no code fences) with this exact structure:
{
  "detected_company": "Company name or Unknown",
  "detected_role": "Role title or Unknown",
  "cover_letter": "Full cover letter text with \\n for line breaks",
  "screening_questions": [
    {
      "question": "Question text",
      "answer": "Answer text",
      "tags": ["tag1", "tag2"],
      "pinned": false
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

  let draftResult: {
    detected_company?: string;
    detected_role?: string;
    cover_letter?: string;
    screening_questions?: Array<{
      question: string;
      answer: string;
      tags: string[];
      pinned?: boolean;
    }>;
    key_requirements?: string[];
    match_score?: number;
    match_notes?: string;
  };
  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    draftResult = JSON.parse(jsonMatch[0]) as typeof draftResult;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse Claude's response" },
      { status: 500 }
    );
  }

  // Post-process: mark pinned questions by checking answer text against pinnedAnswers values
  const pinnedValues = new Set(Object.values(pinnedAnswers));
  const processedQuestions = (draftResult.screening_questions ?? []).map(
    (q) => ({
      ...q,
      pinned: pinnedValues.has(q.answer) || q.pinned === true,
    })
  );

  // If resumeId provided, also get resume tailoring suggestions
  let resumeSuggestions = undefined;
  if (resumeId) {
    const resume = await getResumeById(resumeId);
    if (resume && resume.user_id === user.id) {
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
            (
              experienceSection.content as ExperienceSectionContent
            ).items.map((item) => ({
              title: item.title,
              company: item.company,
              bullets: item.bullets,
            }))
          )
        : "[]";
      const currentSkills = skillsSection
        ? JSON.stringify(
            (skillsSection.content as SkillsSectionContent).categories
          )
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
    letter_type: isSwedish ? "personligt_brev" : "cover_letter",
    language: isSwedish ? "sv" : "en",
    tone,
    screening_questions: processedQuestions,
    key_requirements: draftResult.key_requirements ?? [],
    match_score: draftResult.match_score ?? 0,
    match_notes: draftResult.match_notes ?? "",
    ...(resumeSuggestions ? { resume_suggestions: resumeSuggestions } : {}),
  });
}
