import { createClient } from '@/lib/supabase/server'

// ─── Types ───────────────────────────────────────────────

export type KnowledgeCategory =
  | 'fact' | 'skill' | 'achievement' | 'story'
  | 'value' | 'preference' | 'philosophy' | 'self_assessment'

export type ConfidenceLevel = 'user_confirmed' | 'ai_inferred' | 'imported'
export type SourceType = 'document' | 'interview' | 'manual' | 'application' | 'profile_import'
export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface KnowledgeItem {
  id: string
  user_id: string
  category: KnowledgeCategory
  subcategory: string | null
  title: string
  content: string
  structured_data: Record<string, unknown>
  tags: string[]
  confidence: ConfidenceLevel
  source_type: SourceType
  source_document_ids: string[]
  source_interview_id: string | null
  is_active: boolean
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

export interface UploadedDocument {
  id: string
  user_id: string
  filename: string
  file_type: string
  file_size: number | null
  storage_path: string
  processing_status: ProcessingStatus
  processing_error: string | null
  extracted_text: string | null
  ai_summary: string | null
  document_type: string | null
  source_context: string | null
  extracted_item_count: number
  created_at: string
  updated_at: string
}

export interface KnowledgeProfileSummary {
  id: string
  user_id: string
  executive_summary: string | null
  key_strengths: string[]
  career_narrative: string | null
  leadership_style: string | null
  ideal_role_description: string | null
  unique_value_proposition: string | null
  knowledge_item_count: number
  completeness_scores: Record<string, number>
  last_generated_at: string | null
}

// ─── Interview Session Types ─────────────────────────────

export interface InterviewMessage {
  role: 'ai' | 'user'
  content: string
  timestamp: string
}

export interface InterviewSession {
  id: string
  user_id: string
  topic: string
  topic_label: string | null
  status: 'in_progress' | 'completed' | 'paused'
  messages: InterviewMessage[]
  extracted_item_ids: string[]
  summary: string | null
  question_count: number
  created_at: string
  updated_at: string
}

// ─── Interview Topic Configuration ───────────────────────

export interface InterviewTopic {
  key: string
  label: string
  description: string
  icon: string
  relatedCategories: KnowledgeCategory[]
}

export const INTERVIEW_TOPICS: InterviewTopic[] = [
  {
    key: 'career_narrative',
    label: 'Your Career Story',
    description: 'Walk through your career journey — transitions, motivations, and key moments',
    icon: '🧭',
    relatedCategories: ['fact', 'value', 'philosophy'],
  },
  {
    key: 'strengths',
    label: 'Strengths & Superpowers',
    description: 'What you\'re best at, what colleagues come to you for',
    icon: '💪',
    relatedCategories: ['skill', 'self_assessment'],
  },
  {
    key: 'behavioral_stories',
    label: 'Your Best Stories',
    description: 'Specific examples of leadership, conflict, innovation, and collaboration',
    icon: '📖',
    relatedCategories: ['story', 'achievement'],
  },
  {
    key: 'technical_skills',
    label: 'Technical Deep-Dive',
    description: 'Technologies, tools, and methodologies you\'re experienced with',
    icon: '🔧',
    relatedCategories: ['skill'],
  },
  {
    key: 'leadership',
    label: 'Leadership & Management',
    description: 'How you think about building and leading teams',
    icon: '👥',
    relatedCategories: ['philosophy', 'story', 'value'],
  },
  {
    key: 'role_preferences',
    label: 'What You\'re Looking For',
    description: 'Your ideal role, company, culture, and dealbreakers',
    icon: '🎯',
    relatedCategories: ['preference'],
  },
  {
    key: 'compensation',
    label: 'Compensation & Dealbreakers',
    description: 'Salary expectations, benefits priorities, and non-negotiables',
    icon: '💰',
    relatedCategories: ['preference'],
  },
  {
    key: 'growth',
    label: 'Growth & Development',
    description: 'What you\'re working to improve and where you want to grow',
    icon: '🌱',
    relatedCategories: ['self_assessment', 'preference'],
  },
  {
    key: 'work_philosophy',
    label: 'How You Work',
    description: 'Your working style, problem-solving approach, and values',
    icon: '🧠',
    relatedCategories: ['philosophy', 'value'],
  },
]

// ─── Interview Session Queries ───────────────────────────

export async function getInterviewSessions(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  return (data ?? []) as InterviewSession[]
}

export async function getInterviewSession(sessionId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single()
  return data as InterviewSession | null
}

export async function getActiveSession(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data as InterviewSession | null
}

// ─── Queries ─────────────────────────────────────────────

export async function getKnowledgeItems(
  userId: string,
  filters?: {
    category?: KnowledgeCategory
    confidence?: ConfidenceLevel
    isActive?: boolean
    search?: string
  }
) {
  const supabase = await createClient()
  let query = supabase
    .from('knowledge_items')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (filters?.category) query = query.eq('category', filters.category)
  if (filters?.confidence) query = query.eq('confidence', filters.confidence)
  if (filters?.isActive !== undefined) query = query.eq('is_active', filters.isActive)
  if (filters?.search) query = query.or(`title.ilike.%${filters.search}%,content.ilike.%${filters.search}%`)

  const { data } = await query
  return (data ?? []) as KnowledgeItem[]
}

export async function getKnowledgeItemsByCategory(userId: string) {
  const items = await getKnowledgeItems(userId, { isActive: true })
  const grouped: Record<KnowledgeCategory, KnowledgeItem[]> = {
    fact: [], skill: [], achievement: [], story: [],
    value: [], preference: [], philosophy: [], self_assessment: [],
  }
  for (const item of items) {
    grouped[item.category]?.push(item)
  }
  return grouped
}

export async function getUploadedDocuments(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as UploadedDocument[]
}

export async function getDocumentById(documentId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', userId)
    .single()
  return data as UploadedDocument | null
}

export async function getKnowledgeProfileSummary(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('knowledge_profile_summary')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data as KnowledgeProfileSummary | null
}

export async function getKnowledgeCategoryCounts(userId: string) {
  const items = await getKnowledgeItems(userId, { isActive: true })
  const counts: Record<string, number> = {}
  for (const item of items) {
    counts[item.category] = (counts[item.category] || 0) + 1
  }
  return counts
}

export async function getPendingReviewItems(userId: string) {
  return getKnowledgeItems(userId, { confidence: 'ai_inferred', isActive: true })
}
