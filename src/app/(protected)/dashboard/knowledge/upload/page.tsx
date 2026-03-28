import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUploadedDocuments, getKnowledgeItems } from '@/lib/data/knowledge'
import { UploadZoneWithReview } from '@/components/knowledge/upload-zone-with-review'
import { ChevronLeftIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Upload Documents | Knowledge Base',
}

export default async function KnowledgeUploadPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  // Pre-load recent documents and items for the review panel
  const [documents, recentItems] = await Promise.all([
    getUploadedDocuments(authData.user.id),
    getKnowledgeItems(authData.user.id, { isActive: true }),
  ])

  const recentDocs = documents.slice(0, 10)
  const itemsByDocId: Record<string, typeof recentItems> = {}
  for (const item of recentItems) {
    for (const docId of item.source_document_ids) {
      if (!itemsByDocId[docId]) itemsByDocId[docId] = []
      itemsByDocId[docId].push(item)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/knowledge"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Knowledge Base
        </Link>
        <h1 className="text-xl font-semibold">Upload Documents About You</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload resumes, cover letters, performance reviews, recommendations, project docs —
          anything that captures who you are professionally.
        </p>
      </div>

      {/* Upload Zone + Review (client component handles state) */}
      <UploadZoneWithReview
        initialDocuments={recentDocs}
        itemsByDocId={itemsByDocId}
      />
    </div>
  )
}
