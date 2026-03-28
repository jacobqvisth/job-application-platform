import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// ─── Document Classification ──────────────────────────────

export async function classifyDocument(
  text: string,
  filename: string
): Promise<{ document_type: string; summary: string }> {
  const truncatedText = text.slice(0, 8000)

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You classify professional documents and write a brief summary. Return ONLY valid JSON, no markdown.`,
    messages: [{
      role: 'user',
      content: `Classify this document and write a 2-sentence summary.

Filename: ${filename}

Document text (first ~8000 chars):
${truncatedText}

Return JSON:
{
  "document_type": "<one of: resume, cover_letter, performance_review, recommendation, certificate, project_doc, portfolio, job_description_held, personal_notes, linkedin_export, interview_notes, other>",
  "summary": "<2-sentence summary of what this document contains>"
}`
    }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonText)
}


// ─── Knowledge Extraction ─────────────────────────────────

export interface ExtractedKnowledgeItem {
  category: string
  subcategory: string | null
  title: string
  content: string
  structured_data: Record<string, unknown>
  tags: string[]
}

export async function extractKnowledgeFromDocument(
  text: string,
  documentType: string,
  existingItemTitles: string[]
): Promise<ExtractedKnowledgeItem[]> {
  const maxChars = 12000
  const textToProcess = text.slice(0, maxChars)

  const existingContext = existingItemTitles.length > 0
    ? `\nThe user already has these knowledge items (avoid duplicates):\n${existingItemTitles.slice(0, 30).map(t => `- ${t}`).join('\n')}\n`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: `You extract structured knowledge items from professional documents. Be thorough — pull out every useful piece of information. Be specific — avoid generic observations. Return ONLY a valid JSON array, no markdown or explanation.`,
    messages: [{
      role: 'user',
      content: `Extract all knowledge items from this ${documentType}. Each item should be a discrete, specific piece of information about this person.
${existingContext}
Document text:
${textToProcess}

Return a JSON array where each item has:
{
  "category": "<one of: fact, skill, achievement, story, value, preference, philosophy, self_assessment>",
  "subcategory": "<optional sub-type, e.g. for skill: 'technical'|'soft'|'tool'|'domain'|'language'; for story: 'leadership'|'conflict'|'failure'|'innovation'|'collaboration'; for achievement: 'revenue'|'growth'|'efficiency'|'team_building'|'product_launch'; for preference: 'role'|'company_type'|'industry'|'location'|'compensation'|'culture'>",
  "title": "<short label, max 80 chars, e.g. 'Led platform migration at Spotify serving 2M users'>",
  "content": "<full description — 1-4 sentences. For stories: include situation, action, and result. For achievements: include specific metrics. For skills: describe proficiency level and context.>",
  "structured_data": {
    // Category-specific structured fields:
    // For 'story': { "situation": "...", "task": "...", "action": "...", "result": "..." }
    // For 'achievement': { "metric": "...", "value": "...", "timeframe": "...", "context": "..." }
    // For 'skill': { "level": "expert|advanced|intermediate|basic" }
    // For 'preference': { "priority": "must_have|nice_to_have|dealbreaker" }
    // For 'fact': { "date_range": "...", "company": "...", "role": "..." } (if applicable)
    // For others: {} is fine
  },
  "tags": ["relevant", "tags", "for", "filtering"]
}

Guidelines:
- Extract EVERYTHING useful: employment facts, skills (both stated and demonstrated), achievements with metrics, behavioral stories, values expressed, preferences stated, self-assessments, philosophies
- For resumes: extract each role as a fact + individual bullet achievements separately
- For performance reviews: extract strengths praised, growth areas noted, specific examples as stories
- For cover letters: extract values, motivations, how the person positions themselves
- For recommendations: extract what others say about this person (frame as third-party evidence)
- Be SPECIFIC: "Increased conversion rate by 30% through A/B testing framework" not "Improved metrics"
- Include 3-8 tags per item for filtering (use lowercase, hyphenated)
- Skip information that is trivially obvious or generic
- Do NOT duplicate items already in the existing knowledge list`
    }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const items = JSON.parse(jsonText)
    if (!Array.isArray(items)) return []
    return items.filter((item: ExtractedKnowledgeItem) =>
      item.category && item.title && item.content
    )
  } catch {
    console.error('Failed to parse knowledge extraction response:', rawText.slice(0, 200))
    return []
  }
}
