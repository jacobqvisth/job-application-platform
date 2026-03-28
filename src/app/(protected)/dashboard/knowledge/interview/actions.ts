'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  generateOpeningQuestion,
  processInterviewTurn,
  generateSessionSummary,
  generateProfileSummary,
} from '@/lib/knowledge/interview-ai'
import { getKnowledgeItems, type InterviewMessage, type KnowledgeItem } from '@/lib/data/knowledge'

// ─── Start Interview Session ──────────────────────────────

export async function startInterviewAction(topic: string, topicLabel: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const existingItems = await getKnowledgeItems(user.id, { isActive: true })

  const { data: summary } = await supabase
    .from('knowledge_profile_summary')
    .select('executive_summary')
    .eq('user_id', user.id)
    .single()

  const openingQuestion = await generateOpeningQuestion(
    topic,
    topicLabel,
    existingItems,
    summary?.executive_summary || null
  )

  const messages: InterviewMessage[] = [
    { role: 'ai', content: openingQuestion, timestamp: new Date().toISOString() }
  ]

  const { data: session, error } = await supabase
    .from('interview_sessions')
    .insert({
      user_id: user.id,
      topic,
      topic_label: topicLabel,
      status: 'in_progress',
      messages,
      question_count: 1,
    })
    .select()
    .single()

  if (error || !session) throw new Error('Failed to create interview session')

  revalidatePath('/dashboard/knowledge/interview')
  return { sessionId: session.id, openingQuestion }
}


// ─── Send Response (User answers, AI follows up) ──────────

export async function respondToInterviewAction(sessionId: string, userResponse: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) throw new Error('Session not found')
  if (session.status !== 'in_progress') throw new Error('Session is not active')

  const messages = session.messages as InterviewMessage[]
  const existingItems = await getKnowledgeItems(user.id, { isActive: true })

  const result = await processInterviewTurn(
    session.topic,
    session.topic_label || session.topic,
    messages,
    userResponse,
    existingItems,
    session.question_count
  )

  // Save extracted knowledge items
  const savedItemIds: string[] = []
  if (result.extractedItems.length > 0) {
    const itemsToInsert = result.extractedItems.map(item => ({
      user_id: user.id,
      category: item.category,
      subcategory: item.subcategory || null,
      title: item.title,
      content: item.content,
      structured_data: item.structured_data || {},
      tags: item.tags || [],
      confidence: 'ai_inferred' as const,
      source_type: 'interview' as const,
      source_interview_id: sessionId,
    }))

    const { data: inserted } = await supabase
      .from('knowledge_items')
      .insert(itemsToInsert)
      .select('id')

    if (inserted) {
      savedItemIds.push(...inserted.map((i: { id: string }) => i.id))
    }
  }

  const updatedMessages: InterviewMessage[] = [
    ...messages,
    { role: 'user', content: userResponse, timestamp: new Date().toISOString() },
    { role: 'ai', content: result.aiResponse, timestamp: new Date().toISOString() },
  ]

  const updatedExtractedIds = [...(session.extracted_item_ids || []), ...savedItemIds]

  await supabase
    .from('interview_sessions')
    .update({
      messages: updatedMessages,
      question_count: session.question_count + 1,
      extracted_item_ids: updatedExtractedIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  revalidatePath('/dashboard/knowledge/interview')
  revalidatePath('/dashboard/knowledge')

  return {
    aiResponse: result.aiResponse,
    extractedItems: result.extractedItems,
    savedItemIds,
    shouldContinueTopic: result.shouldContinueTopic,
  }
}


// ─── End Interview Session ────────────────────────────────

export async function endInterviewAction(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: session } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) throw new Error('Session not found')

  const messages = session.messages as InterviewMessage[]

  const summaryText = await generateSessionSummary(
    session.topic,
    session.topic_label || session.topic,
    messages,
    (session.extracted_item_ids || []).length
  )

  await supabase
    .from('interview_sessions')
    .update({
      status: 'completed',
      summary: summaryText,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)

  revalidatePath('/dashboard/knowledge/interview')
  revalidatePath('/dashboard/knowledge')

  return { summary: summaryText }
}


// ─── Pause Interview Session ──────────────────────────────

export async function pauseInterviewAction(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('interview_sessions')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge/interview')
}


// ─── Resume Interview Session ─────────────────────────────

export async function resumeInterviewAction(sessionId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('interview_sessions')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge/interview')
}


// ─── Generate/Regenerate Profile Summary ──────────────────

export async function generateProfileSummaryAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: items } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .in('confidence', ['user_confirmed', 'ai_inferred'])

  if (!items || items.length < 3) {
    throw new Error('Need at least 3 knowledge items to generate a profile summary. Upload documents or complete an interview first.')
  }

  const { data: profile } = await supabase
    .from('user_profile_data')
    .select('summary, work_history, skills')
    .eq('user_id', user.id)
    .single()

  const summaryData = await generateProfileSummary(items as KnowledgeItem[], profile)

  const categoryCounts: Record<string, number> = {}
  for (const item of items) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1
  }

  const thresholds: Record<string, number> = {
    fact: 10, skill: 8, achievement: 5, story: 6,
    value: 3, preference: 5, philosophy: 2, self_assessment: 3,
  }

  const completenessScores: Record<string, number> = {}
  for (const [cat, threshold] of Object.entries(thresholds)) {
    completenessScores[cat] = Math.min((categoryCounts[cat] || 0) / threshold, 1.0)
  }

  await supabase
    .from('knowledge_profile_summary')
    .upsert({
      user_id: user.id,
      executive_summary: summaryData.executive_summary,
      key_strengths: summaryData.key_strengths,
      career_narrative: summaryData.career_narrative,
      leadership_style: summaryData.leadership_style,
      ideal_role_description: summaryData.ideal_role_description,
      unique_value_proposition: summaryData.unique_value_proposition,
      knowledge_item_count: items.length,
      completeness_scores: completenessScores,
      last_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  revalidatePath('/dashboard/knowledge')
}
