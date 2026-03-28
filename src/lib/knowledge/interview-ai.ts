import Anthropic from '@anthropic-ai/sdk'
import type { KnowledgeItem, InterviewMessage } from '@/lib/data/knowledge'

const anthropic = new Anthropic()

// ─── Generate Opening Question ────────────────────────────

export async function generateOpeningQuestion(
  topic: string,
  topicLabel: string,
  existingKnowledge: KnowledgeItem[],
  profileSummary: string | null
): Promise<string> {
  const knowledgeContext = existingKnowledge.length > 0
    ? `What I already know about this person:\n${existingKnowledge.slice(0, 15).map(k => `- [${k.category}] ${k.title}: ${k.content.slice(0, 150)}`).join('\n')}`
    : 'I don\'t know much about this person yet.'

  const profileContext = profileSummary
    ? `Profile summary: ${profileSummary.slice(0, 500)}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: `You are a warm, professional career coach conducting a discovery interview. Your goal is to deeply understand this person so you can help them with job applications later.

Rules:
- Ask exactly ONE question
- Be conversational and warm — like talking to a friend who happens to be a great coach
- Reference what you already know about them if relevant ("I see you've worked at X...")
- Ask open-ended questions that invite stories and specifics
- Don't be generic — tailor to what you know (or don't know) about them
- Keep it to 2-3 sentences max`,
    messages: [{
      role: 'user',
      content: `Generate the opening question for a "${topicLabel}" interview session.

${knowledgeContext}

${profileContext}

Topic focus: ${topic}

Return ONLY the question text — no JSON, no formatting, just the natural conversational question.`
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}


// ─── Process User Response + Generate Follow-up ───────────

export interface InterviewTurnResult {
  aiResponse: string
  extractedItems: Array<{
    category: string
    subcategory: string | null
    title: string
    content: string
    structured_data: Record<string, unknown>
    tags: string[]
  }>
  shouldContinueTopic: boolean
}

export async function processInterviewTurn(
  topic: string,
  topicLabel: string,
  conversationHistory: InterviewMessage[],
  userResponse: string,
  existingKnowledge: KnowledgeItem[],
  questionCount: number
): Promise<InterviewTurnResult> {
  const knowledgeContext = existingKnowledge.length > 0
    ? `Existing knowledge about this person:\n${existingKnowledge.slice(0, 20).map(k => `- [${k.category}] ${k.title}`).join('\n')}`
    : ''

  const recentMessages = conversationHistory.slice(-10)
  const conversationText = recentMessages
    .map(m => `${m.role === 'ai' ? 'Coach' : 'User'}: ${m.content}`)
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You are a warm, professional career coach conducting a discovery interview about "${topicLabel}". You have two jobs:

1. RESPOND to the user — follow up with a probing question, ask for specifics, or acknowledge and move to the next area
2. EXTRACT knowledge items from what the user just said

Rules for responding:
- Ask ONE follow-up question per turn
- Push for SPECIFICS: metrics, numbers, timelines, team sizes, outcomes
- When they tell a story, probe for the full STAR structure (Situation, Task, Action, Result)
- After 4-6 exchanges on one thread, summarize what you learned and either move to a new angle or suggest wrapping up
- Be warm and encouraging — validate interesting points before probing deeper
- If the user gives a short answer, draw them out ("That's interesting — can you tell me more about how that played out?")
- If they've covered a topic thoroughly, say so and suggest moving on

Rules for extraction:
- Extract EVERY discrete piece of useful information
- Be specific — "Managed team of 8 engineers at Spotify" not "Has management experience"
- For stories: capture the full STAR structure in structured_data
- For achievements: always include metrics if mentioned
- Don't extract things already in the existing knowledge list
- It's fine to extract 0 items if the response doesn't contain new concrete information

Return ONLY valid JSON:
{
  "ai_response": "Your conversational follow-up question or comment (2-4 sentences max)",
  "extracted_items": [
    {
      "category": "story|achievement|skill|fact|value|preference|philosophy|self_assessment",
      "subcategory": "optional subcategory",
      "title": "Short label, max 80 chars",
      "content": "Full description, 1-4 sentences",
      "structured_data": {},
      "tags": ["tag1", "tag2"]
    }
  ],
  "should_continue_topic": true
}

Set should_continue_topic to false when:
- The topic feels thoroughly covered (5+ exchanges)
- The user explicitly wants to move on
- You've asked about all major angles of this topic`,
    messages: [{
      role: 'user',
      content: `Topic: ${topicLabel} (${topic})
Question count so far: ${questionCount}

${knowledgeContext}

Conversation so far:
${conversationText}

User's latest response:
${userResponse}

Generate your follow-up and extract any knowledge items.`
    }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

  try {
    const parsed = JSON.parse(jsonText)
    return {
      aiResponse: parsed.ai_response || '',
      extractedItems: (parsed.extracted_items || []).filter(
        (item: { category?: string; title?: string; content?: string }) =>
          item.category && item.title && item.content
      ),
      shouldContinueTopic: parsed.should_continue_topic !== false,
    }
  } catch {
    return {
      aiResponse: "That's really helpful context. Could you tell me a bit more about that?",
      extractedItems: [],
      shouldContinueTopic: true,
    }
  }
}


// ─── Generate Session Summary ─────────────────────────────

export async function generateSessionSummary(
  topic: string,
  topicLabel: string,
  messages: InterviewMessage[],
  extractedItemCount: number
): Promise<string> {
  const conversationText = messages
    .map(m => `${m.role === 'ai' ? 'Coach' : 'User'}: ${m.content}`)
    .join('\n\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Summarize what was learned in this career discovery interview session in 2-3 sentences. Be specific about key insights, not generic.',
    messages: [{
      role: 'user',
      content: `Topic: ${topicLabel}\nItems extracted: ${extractedItemCount}\n\nConversation:\n${conversationText.slice(0, 6000)}`
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : ''
}


// ─── Generate Profile Summary ─────────────────────────────

export async function generateProfileSummary(
  knowledgeItems: KnowledgeItem[],
  profileData: { summary?: string | null; work_history?: unknown[] | null; skills?: string[] | null } | null
): Promise<{
  executive_summary: string
  key_strengths: string[]
  career_narrative: string
  leadership_style: string | null
  ideal_role_description: string | null
  unique_value_proposition: string
}> {
  const grouped: Record<string, string[]> = {}
  for (const item of knowledgeItems) {
    if (!grouped[item.category]) grouped[item.category] = []
    grouped[item.category].push(`${item.title}: ${item.content.slice(0, 200)}`)
  }

  const knowledgeText = Object.entries(grouped)
    .map(([cat, items]) => `${cat.toUpperCase()}:\n${items.slice(0, 10).map(i => `- ${i}`).join('\n')}`)
    .join('\n\n')

  const profileText = profileData?.summary
    ? `Existing profile summary: ${profileData.summary}`
    : ''

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: 'You synthesize a professional identity profile from structured knowledge items. Write in third person. Be specific and authentic — this should sound like the person, not a generic template. Return ONLY valid JSON.',
    messages: [{
      role: 'user',
      content: `Generate a professional identity summary from this person's knowledge base.

${knowledgeText}

${profileText}

Return JSON:
{
  "executive_summary": "2-3 paragraph professional identity overview",
  "key_strengths": ["strength 1", "strength 2", "..."],
  "career_narrative": "The story of their career (1-2 paragraphs)",
  "leadership_style": "How they lead and manage, or null if not enough data",
  "ideal_role_description": "What they're looking for, or null if not enough data",
  "unique_value_proposition": "1-2 sentences: what makes this person uniquely valuable"
}`
    }],
  })

  const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
  const jsonText = rawText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
  return JSON.parse(jsonText)
}
