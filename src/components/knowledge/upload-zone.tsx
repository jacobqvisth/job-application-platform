'use client'

import { useState, useRef, useTransition, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadAndProcessDocumentAction } from '@/app/(protected)/dashboard/knowledge/actions'
import { toast } from 'sonner'
import { UploadCloudIcon, FileTextIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react'

interface QueuedFile {
  id: string
  file: File
  sourceContext: string
  status: 'waiting' | 'processing' | 'complete' | 'error'
  error?: string
  documentId?: string
}

interface UploadZoneProps {
  onDocumentProcessed?: (documentId: string) => void
}

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt', 'md']

function getExt(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function StatusIcon({ status }: { status: QueuedFile['status'] }) {
  if (status === 'waiting') return <span className="text-muted-foreground text-xs">⏳ Waiting</span>
  if (status === 'processing') return (
    <span className="flex items-center gap-1 text-xs text-primary">
      <LoaderIcon className="h-3 w-3 animate-spin" />
      Processing...
    </span>
  )
  if (status === 'complete') return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircleIcon className="h-3.5 w-3.5" /> Complete</span>
  return <span className="flex items-center gap-1 text-xs text-destructive"><XCircleIcon className="h-3.5 w-3.5" /> Failed</span>
}

export function UploadZone({ onDocumentProcessed }: UploadZoneProps) {
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  function addFiles(files: FileList | File[]) {
    const newFiles: QueuedFile[] = []
    for (const file of Array.from(files)) {
      const ext = getExt(file.name)
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast.error(`Unsupported file type: .${ext}`)
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`)
        continue
      }
      newFiles.push({
        id: crypto.randomUUID(),
        file,
        sourceContext: '',
        status: 'waiting',
      })
    }
    if (newFiles.length > 0) {
      setQueue(prev => [...prev, ...newFiles])
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(e.dataTransfer.files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(e.target.files)
      e.target.value = ''
    }
  }

  function updateContext(id: string, value: string) {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, sourceContext: value } : q))
  }

  function removeFromQueue(id: string) {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  const processQueue = useCallback(() => {
    if (processingRef.current) return
    processingRef.current = true

    startTransition(async () => {
      // Get waiting items in order
      const waiting = queue.filter(q => q.status === 'waiting')

      for (const item of waiting) {
        // Mark as processing
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q))

        try {
          const formData = new FormData()
          formData.append('file', item.file)
          if (item.sourceContext) formData.append('sourceContext', item.sourceContext)

          const { documentId } = await uploadAndProcessDocumentAction(formData)

          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'complete', documentId } : q
          ))
          onDocumentProcessed?.(documentId)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Processing failed'
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'error', error: message } : q
          ))
          toast.error(`Failed: ${item.file.name} — ${message}`)
        }
      }

      processingRef.current = false
    })
  }, [queue, onDocumentProcessed])

  const hasWaiting = queue.some(q => q.status === 'waiting')

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.md"
          className="sr-only"
          onChange={handleFileInput}
        />
        <div className="flex flex-col items-center gap-3">
          <UploadCloudIcon className={`h-10 w-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
          <div>
            <p className="font-medium text-sm">Drag & drop files here</p>
            <p className="text-xs text-muted-foreground mt-0.5">or click to browse</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Supports: PDF, DOCX, TXT, MD · Max 10MB each
          </p>
        </div>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Upload Queue</h3>
          <div className="space-y-2">
            {queue.map(item => (
              <div key={item.id} className="rounded-lg border bg-card p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <FileTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm font-medium truncate">{item.file.name}</span>
                  <StatusIcon status={item.status} />
                  {item.status === 'waiting' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(item.id) }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <XCircleIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {item.status === 'waiting' && (
                  <Input
                    value={item.sourceContext}
                    onChange={e => updateContext(item.id, e.target.value)}
                    placeholder='What is this document? (optional) e.g. "My 2024 performance review"'
                    className="h-7 text-xs"
                    onClick={e => e.stopPropagation()}
                  />
                )}
                {item.status === 'error' && item.error && (
                  <p className="text-xs text-destructive">{item.error}</p>
                )}
              </div>
            ))}
          </div>

          {hasWaiting && (
            <Button
              onClick={processQueue}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                `Process ${queue.filter(q => q.status === 'waiting').length} file${queue.filter(q => q.status === 'waiting').length !== 1 ? 's' : ''}`
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
