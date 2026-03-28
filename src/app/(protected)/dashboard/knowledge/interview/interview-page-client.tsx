'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { TopicSelector } from '@/components/knowledge/topic-selector'
import { InterviewChat } from '@/components/knowledge/interview-chat'
import { SessionSummary } from '@/components/knowledge/session-summary'
import {
  startInterviewAction,
  endInterviewAction,
  pauseInterviewAction,
  resumeInterviewAction,
  generateProfileSummaryAction,
} from './actions'
import type { InterviewTopic, InterviewMessage } from '@/lib/data/knowledge'

interface InterviewSession {
  id: string
  topic: string
  topic_label: string | null
  status: string
  messages: InterviewMessage[]
  extracted_item_ids: string[]
  summary: string | null
  question_count: number
  created_at: string
  updated_at: string
}

type ViewState =
  | { type: 'topics' }
  | { type: 'chat'; sessionId: string; topicLabel: string; messages: InterviewMessage[] }
  | { type: 'summary'; summary: string; extractedItemCount: number; topicLabel: string }

interface Props {
  topics: InterviewTopic[]
  sessions: InterviewSession[]
  categoryCounts: Record<string, number>
  activeSession: InterviewSession | null
}

export function InterviewPageClient({ topics, sessions, categoryCounts, activeSession }: Props) {
  const router = useRouter()
  const [view, setView] = useState<ViewState>(
    activeSession
      ? {
          type: 'chat',
          sessionId: activeSession.id,
          topicLabel: activeSession.topic_label || activeSession.topic,
          messages: activeSession.messages as InterviewMessage[],
        }
      : { type: 'topics' }
  )
  const [isStarting, setIsStarting] = useState(false)

  async function handleSelectTopic(key: string, label: string) {
    setIsStarting(true)
    try {
      const result = await startInterviewAction(key, label)
      setView({
        type: 'chat',
        sessionId: result.sessionId,
        topicLabel: label,
        messages: [{ role: 'ai', content: result.openingQuestion, timestamp: new Date().toISOString() }],
      })
    } catch (err) {
      console.error('Failed to start interview:', err)
    } finally {
      setIsStarting(false)
    }
  }

  async function handleResumeSession(sessionId: string) {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return
    try {
      await resumeInterviewAction(sessionId)
      setView({
        type: 'chat',
        sessionId: session.id,
        topicLabel: session.topic_label || session.topic,
        messages: session.messages as InterviewMessage[],
      })
    } catch (err) {
      console.error('Failed to resume session:', err)
    }
  }

  async function handleEndSession() {
    if (view.type !== 'chat') return
    try {
      const result = await endInterviewAction(view.sessionId)
      setView({
        type: 'summary',
        summary: result.summary,
        extractedItemCount: 0, // Will be updated from server
        topicLabel: view.topicLabel,
      })
      router.refresh()
    } catch (err) {
      console.error('Failed to end session:', err)
    }
  }

  async function handlePauseSession() {
    if (view.type !== 'chat') return
    try {
      await pauseInterviewAction(view.sessionId)
      setView({ type: 'topics' })
      router.refresh()
    } catch (err) {
      console.error('Failed to pause session:', err)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/dashboard/knowledge" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <MessageCircle className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Interview: Tell Me About Yourself</h1>
      </div>

      {view.type === 'topics' && (
        <>
          <p className="text-sm text-muted-foreground">
            I&apos;ll ask questions to learn about your career, skills, and what makes you unique.
            This helps me write better applications for you.
          </p>
          {isStarting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="animate-spin">⏳</span> Starting interview...
            </div>
          )}
          <TopicSelector
            topics={topics}
            sessions={sessions}
            categoryCounts={categoryCounts}
            onSelectTopic={handleSelectTopic}
            onResumeSession={handleResumeSession}
          />
        </>
      )}

      {view.type === 'chat' && (
        <InterviewChat
          sessionId={view.sessionId}
          topicLabel={view.topicLabel}
          initialMessages={view.messages}
          onEnd={handleEndSession}
          onPause={handlePauseSession}
        />
      )}

      {view.type === 'summary' && (
        <SessionSummary
          summary={view.summary}
          extractedItemCount={view.extractedItemCount}
          topicLabel={view.topicLabel}
          onStartAnother={() => {
            setView({ type: 'topics' })
            router.refresh()
          }}
          onGenerateProfile={async () => {
            await generateProfileSummaryAction()
            router.refresh()
          }}
          onReviewItems={() => {
            router.push('/dashboard/knowledge?confidence=ai_inferred')
          }}
        />
      )}
    </div>
  )
}
