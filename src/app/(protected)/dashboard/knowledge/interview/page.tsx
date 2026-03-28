import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  getKnowledgeCategoryCounts,
  getKnowledgeProfileSummary,
  INTERVIEW_TOPICS,
} from '@/lib/data/knowledge'
import { InterviewPageClient } from './interview-page-client'

export const metadata: Metadata = {
  title: 'Interview | Knowledge Base',
  description: 'AI-guided interview to discover your career knowledge',
}

export default async function InterviewPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const userId = authData.user.id

  // Fetch sessions
  const { data: sessions } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  // Fetch category counts for suggestion scoring
  const counts = await getKnowledgeCategoryCounts(userId)

  // Check for active session
  const activeSession = (sessions ?? []).find(
    (s: { status: string }) => s.status === 'in_progress'
  )

  return (
    <InterviewPageClient
      topics={INTERVIEW_TOPICS}
      sessions={sessions ?? []}
      categoryCounts={counts}
      activeSession={activeSession ?? null}
    />
  )
}
