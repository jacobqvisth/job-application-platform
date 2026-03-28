'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Pause, LogOut } from 'lucide-react'
import { VoiceInputButton } from '@/components/knowledge/voice-input-button'
import { respondToInterviewAction } from '@/app/(protected)/dashboard/knowledge/interview/actions'
import { cn } from '@/lib/utils'

interface Message {
  role: 'ai' | 'user'
  content: string
  timestamp: string
}

interface ExtractedItem {
  category: string
  title: string
}

interface InterviewChatProps {
  sessionId: string
  topicLabel: string
  initialMessages: Message[]
  onEnd: () => void
  onPause: () => void
}

export function InterviewChat({
  sessionId,
  topicLabel,
  initialMessages,
  onEnd,
  onPause,
}: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [extractedItemsMap, setExtractedItemsMap] = useState<Record<number, ExtractedItem[]>>({})
  const [shouldContinue, setShouldContinue] = useState(true)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [inputValue])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMessage])
    const sentText = inputValue.trim()
    setInputValue('')
    setIsLoading(true)

    try {
      const result = await respondToInterviewAction(sessionId, sentText)

      const aiMessage: Message = {
        role: 'ai',
        content: result.aiResponse,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, aiMessage])

      if (result.extractedItems && result.extractedItems.length > 0) {
        setExtractedItemsMap(prev => ({
          ...prev,
          [messages.length + 1]: result.extractedItems as ExtractedItem[],
        }))
      }

      setShouldContinue(result.shouldContinueTopic)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, messages.length, sessionId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSendMessage()
      }
    },
    [handleSendMessage]
  )

  return (
    <div className="flex flex-col border rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">{topicLabel}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPause}>
            <Pause className="w-3.5 h-3.5 mr-1.5" />
            Pause
          </Button>
          {showEndConfirm ? (
            <Button variant="destructive" size="sm" onClick={onEnd}>
              Confirm End
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700"
              onClick={() => setShowEndConfirm(true)}
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              End Session
            </Button>
          )}
          {showEndConfirm && (
            <Button variant="ghost" size="sm" onClick={() => setShowEndConfirm(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((message, index) => (
          <div key={index}>
            <div className={cn(
              'flex w-full',
              message.role === 'ai' ? 'justify-start' : 'justify-end'
            )}>
              <div className={cn(
                'max-w-md lg:max-w-lg rounded-lg p-3',
                message.role === 'ai'
                  ? 'bg-muted text-foreground'
                  : 'bg-primary/10 text-foreground'
              )}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
            {extractedItemsMap[index] && (
              <div className="flex justify-start mt-1.5 gap-1.5 flex-wrap">
                {extractedItemsMap[index].map((item, itemIdx) => (
                  <span key={itemIdx} className="text-xs bg-emerald-50 text-emerald-700 rounded px-2 py-0.5 border border-emerald-200">
                    ✨ {item.category}: {item.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        {!shouldContinue && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 text-sm rounded px-4 py-3">
            This topic seems well covered. You can end the session or keep going.
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer or use voice input..."
            className="resize-none overflow-hidden min-h-[40px]"
            rows={1}
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1.5">
            <VoiceInputButton
              onTranscript={(text: string) => setInputValue(prev => prev ? prev + ' ' + text : text)}
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-primary hover:bg-primary/90 h-9 w-9"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
