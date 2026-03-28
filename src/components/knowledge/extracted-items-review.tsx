'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { KnowledgeItem } from '@/lib/data/knowledge'
import { KnowledgeItemCard } from './knowledge-item-card'
import {
  bulkConfirmItemsAction,
  bulkRejectItemsAction,
} from '@/app/(protected)/dashboard/knowledge/actions'
import { toast } from 'sonner'
import { CheckCheckIcon, XIcon } from 'lucide-react'

interface ExtractedItemsReviewProps {
  documentName: string
  documentType: string
  items: KnowledgeItem[]
}

export function ExtractedItemsReview({
  documentName,
  documentType,
  items,
}: ExtractedItemsReviewProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [localItems, setLocalItems] = useState(items)
  const [isPending, startTransition] = useTransition()

  function handleSelect(id: string, checked: boolean) {
    setSelected(prev => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function handleConfirmed(id: string) {
    setLocalItems(prev => prev.map(i => i.id === id ? { ...i, confidence: 'user_confirmed' } : i))
  }

  function handleRejected(id: string) {
    setLocalItems(prev => prev.filter(i => i.id !== id))
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  function handleAcceptAll() {
    const ids = localItems.filter(i => i.confidence === 'ai_inferred').map(i => i.id)
    if (ids.length === 0) return
    startTransition(async () => {
      try {
        await bulkConfirmItemsAction(ids)
        setLocalItems(prev => prev.map(i => ({ ...i, confidence: 'user_confirmed' })))
        setSelected(new Set())
        toast.success(`${ids.length} items confirmed`)
      } catch {
        toast.error('Failed to confirm items')
      }
    })
  }

  function handleConfirmSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    startTransition(async () => {
      try {
        await bulkConfirmItemsAction(ids)
        setLocalItems(prev => prev.map(i =>
          selected.has(i.id) ? { ...i, confidence: 'user_confirmed' } : i
        ))
        setSelected(new Set())
        toast.success(`${ids.length} items confirmed`)
      } catch {
        toast.error('Failed to confirm items')
      }
    })
  }

  function handleRejectSelected() {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    startTransition(async () => {
      try {
        await bulkRejectItemsAction(ids)
        setLocalItems(prev => prev.filter(i => !selected.has(i.id)))
        setSelected(new Set())
        toast.success(`${ids.length} items removed`)
      } catch {
        toast.error('Failed to remove items')
      }
    })
  }

  const pendingCount = localItems.filter(i => i.confidence === 'ai_inferred').length

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-sm">
              From: <span className="text-primary">{documentName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {documentType.replace(/_/g, ' ')} · {localItems.length} items extracted
            </p>
          </div>
          {pendingCount > 0 && (
            <Button
              size="sm"
              onClick={handleAcceptAll}
              disabled={isPending}
              className="gap-1.5 shrink-0"
            >
              <CheckCheckIcon className="h-3.5 w-3.5" />
              Accept All ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground flex-1">
            {selected.size} item{selected.size !== 1 ? 's' : ''} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleConfirmSelected}
            disabled={isPending}
            className="h-7 gap-1 text-xs"
          >
            <CheckCheckIcon className="h-3 w-3" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRejectSelected}
            disabled={isPending}
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
          >
            <XIcon className="h-3 w-3" />
            Reject
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {localItems.map(item => (
          <KnowledgeItemCard
            key={item.id}
            item={item}
            mode="review"
            selected={selected.has(item.id)}
            onSelect={handleSelect}
            onConfirm={handleConfirmed}
            onReject={handleRejected}
          />
        ))}
        {localItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            All items have been reviewed.
          </p>
        )}
      </div>
    </div>
  )
}
