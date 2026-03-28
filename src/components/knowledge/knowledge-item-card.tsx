'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { KnowledgeItem, KnowledgeCategory } from '@/lib/data/knowledge'
import {
  confirmKnowledgeItemAction,
  rejectKnowledgeItemAction,
  updateKnowledgeItemAction,
} from '@/app/(protected)/dashboard/knowledge/actions'
import { toast } from 'sonner'
import { CheckIcon, XIcon, PencilIcon, XCircleIcon } from 'lucide-react'

export interface KnowledgeItemCardProps {
  item: KnowledgeItem
  mode: 'review' | 'manage'
  onConfirm?: (id: string) => void
  onReject?: (id: string) => void
  onEdit?: (id: string) => void
  selected?: boolean
  onSelect?: (id: string, selected: boolean) => void
}

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  fact: 'bg-slate-100 text-slate-700 border-slate-200',
  skill: 'bg-blue-100 text-blue-700 border-blue-200',
  achievement: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  story: 'bg-amber-100 text-amber-700 border-amber-200',
  value: 'bg-purple-100 text-purple-700 border-purple-200',
  preference: 'bg-teal-100 text-teal-700 border-teal-200',
  philosophy: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  self_assessment: 'bg-rose-100 text-rose-700 border-rose-200',
}

const CATEGORY_LABELS: Record<string, string> = {
  fact: 'Fact',
  skill: 'Skill',
  achievement: 'Achievement',
  story: 'Story',
  value: 'Value',
  preference: 'Preference',
  philosophy: 'Philosophy',
  self_assessment: 'Self-Assessment',
}

const CATEGORIES: KnowledgeCategory[] = [
  'fact', 'skill', 'achievement', 'story',
  'value', 'preference', 'philosophy', 'self_assessment',
]

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === 'user_confirmed') return <span className="text-xs text-emerald-600">✅ Confirmed</span>
  if (confidence === 'ai_inferred') return <span className="text-xs text-amber-600">⚡ Needs review</span>
  return <span className="text-xs text-slate-500">📥 Imported</span>
}

export function KnowledgeItemCard({
  item,
  mode,
  onConfirm,
  onReject,
  selected,
  onSelect,
}: KnowledgeItemCardProps) {
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [editTitle, setEditTitle] = useState(item.title)
  const [editContent, setEditContent] = useState(item.content)
  const [editCategory, setEditCategory] = useState(item.category)
  const [editSubcategory, setEditSubcategory] = useState(item.subcategory ?? '')
  const [editTags, setEditTags] = useState<string[]>(item.tags)
  const [tagInput, setTagInput] = useState('')

  const colorClass = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.fact

  function handleConfirm() {
    startTransition(async () => {
      try {
        await confirmKnowledgeItemAction(item.id)
        onConfirm?.(item.id)
        toast.success('Item confirmed')
      } catch {
        toast.error('Failed to confirm item')
      }
    })
  }

  function handleReject() {
    startTransition(async () => {
      try {
        await rejectKnowledgeItemAction(item.id)
        onReject?.(item.id)
        toast.success('Item removed')
      } catch {
        toast.error('Failed to remove item')
      }
    })
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await updateKnowledgeItemAction(item.id, {
          title: editTitle,
          content: editContent,
          category: editCategory,
          subcategory: editSubcategory || null,
          tags: editTags,
        })
        setEditing(false)
        toast.success('Item updated')
      } catch {
        toast.error('Failed to update item')
      }
    })
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
      if (!editTags.includes(tag)) {
        setEditTags([...editTags, tag])
      }
      setTagInput('')
    }
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter(t => t !== tag))
  }

  if (editing) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Select value={editCategory} onValueChange={(v) => setEditCategory(v as KnowledgeCategory)}>
            <SelectTrigger className="w-40 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={editSubcategory}
            onChange={e => setEditSubcategory(e.target.value)}
            placeholder="Subcategory (optional)"
            className="h-7 text-xs flex-1"
          />
        </div>
        <Input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          placeholder="Title"
          className="font-medium"
        />
        <Textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          placeholder="Content"
          rows={3}
          className="text-sm"
        />
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {editTags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
              >
                {tag}
                <button onClick={() => removeTag(tag)} className="text-muted-foreground hover:text-foreground">
                  <XCircleIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag (press Enter)"
            className="h-7 text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border bg-card p-4 space-y-2 ${selected ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-start gap-2">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected ?? false}
            onChange={e => onSelect(item.id, e.target.checked)}
            className="mt-0.5 h-4 w-4 cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}>
              {CATEGORY_LABELS[item.category] ?? item.category}
              {item.subcategory && ` · ${item.subcategory}`}
            </span>
            <ConfidenceBadge confidence={item.confidence} />
          </div>
          <p className="font-medium text-sm leading-snug line-clamp-1">{item.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.content}</p>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.slice(0, 4).map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs px-1.5 py-0 h-5">
                  {tag}
                </Badge>
              ))}
              {item.tags.length > 4 && (
                <span className="text-xs text-muted-foreground">+{item.tags.length - 4} more</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        {(mode === 'review' || item.confidence === 'ai_inferred') && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50"
            onClick={handleConfirm}
            disabled={isPending}
          >
            <CheckIcon className="h-3 w-3" />
            Confirm
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs"
          onClick={() => setEditing(true)}
          disabled={isPending}
        >
          <PencilIcon className="h-3 w-3" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleReject}
          disabled={isPending}
        >
          <XIcon className="h-3 w-3" />
          {mode === 'review' ? 'Reject' : 'Remove'}
        </Button>
      </div>
    </div>
  )
}
