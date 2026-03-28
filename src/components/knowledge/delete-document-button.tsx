'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { deleteDocumentAction } from '@/app/(protected)/dashboard/knowledge/actions'
import { toast } from 'sonner'
import { Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeleteDocumentButtonProps {
  documentId: string
  filename: string
}

export function DeleteDocumentButton({ documentId, filename }: DeleteDocumentButtonProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteDocumentAction(documentId)
        toast.success('Document deleted')
        setOpen(false)
        router.refresh()
      } catch {
        toast.error('Failed to delete document')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Document</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mt-1">
          Delete <span className="font-medium text-foreground">{filename}</span>? This will also
          remove all AI-extracted knowledge items linked to this document.
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
