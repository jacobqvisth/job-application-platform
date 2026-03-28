'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { useVoiceInput } from '@/hooks/use-voice-input'

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function VoiceInputButton({ onTranscript, disabled }: VoiceInputButtonProps) {
  const [isSupported, setIsSupported] = useState(false)
  const { isListening, transcript, startListening, stopListening, resetTranscript } = useVoiceInput()
  const prevListeningRef = useRef(false)

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    )
  }, [])

  // Fire onTranscript when listening stops with a non-empty transcript
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript) {
      onTranscript(transcript)
      resetTranscript()
    }
    prevListeningRef.current = isListening
  }, [isListening, transcript, onTranscript, resetTranscript])

  if (!isSupported) return null

  const handleToggle = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  return (
    <Button
      type="button"
      size="icon"
      variant={isListening ? 'default' : 'outline'}
      className={isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse h-9 w-9' : 'h-9 w-9'}
      onClick={handleToggle}
      disabled={disabled}
      aria-label={isListening ? 'Stop recording' : 'Start voice input'}
    >
      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
    </Button>
  )
}
