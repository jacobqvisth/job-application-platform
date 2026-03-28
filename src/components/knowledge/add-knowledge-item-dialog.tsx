'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addKnowledgeItemAction } from '@/app/(protected)/dashboard/knowledge/actions'
import { toast } from 'sonner'
import { XCircleIcon } from 'lucide-react'

interface AddKnowledgeItemDialogProps {
  children: React.ReactNode
}

const CATEGORIES = [
  { value: 'fact', label: 'Fact' },
  { value: 'skill', label: 'Skill' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'story', label: 'Story' },
  { value: 'value', label: 'Value' },
  { value: 'preference', label: 'Preference' },
  { value: 'philosophy', label: 'Philosophy' },
  { value: 'self_assessment', label: 'Self-Assessment' },
]

export function AddKnowledgeItemDialog({ children }: AddKnowledgeItemDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [category, setCategory] = useState('fact')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  function reset() {
    setCategory('fact')
    setTitle('')
    setContent('')
    setSubcategory('')
    setTags([])
    setTagInput('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return
    startTransition(async () => {
      try {
        await addKnowledgeItemAction({
          category,
          subcategory: subcategory || null,
          title: title.trim(),
          content: content.trim(),
          tags,
        })
        toast.success('Knowledge item added')
        reset()
        setOpen(false)
      } catch {
        toast.error('Failed to add item')
      }
    })
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
      if (!tags.includes(tag)) setTags([...tags, tag])
      setTagInput('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Knowledge Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={subcategory}
              onChange={e => setSubcategory(e.target.value)}
              placeholder="Subcategory (optional)"
              className="flex-1"
            />
          </div>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title (e.g. Led team of 8 engineers at Acme)"
            required
          />
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Describe this in detail..."
            rows={3}
            required
          />
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(tags.filter(t => t !== tag))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <XCircleIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tags (press Enter)"
              className="h-8 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !title.trim() || !content.trim()}>
              Add Item
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
