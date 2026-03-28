'use client'

import { useState } from 'react'
import { UploadZone } from './upload-zone'
import { ExtractedItemsReview } from './extracted-items-review'
import { UploadedDocument, KnowledgeItem } from '@/lib/data/knowledge'
import { createClient } from '@/lib/supabase/client'

interface UploadZoneWithReviewProps {
  initialDocuments: UploadedDocument[]
  itemsByDocId: Record<string, KnowledgeItem[]>
}

export function UploadZoneWithReview({
  initialDocuments,
  itemsByDocId: initialItemsByDocId,
}: UploadZoneWithReviewProps) {
  const [processedDocIds, setProcessedDocIds] = useState<string[]>([])
  const [loadedDocs, setLoadedDocs] = useState<Record<string, UploadedDocument>>(() => {
    const map: Record<string, UploadedDocument> = {}
    for (const doc of initialDocuments) map[doc.id] = doc
    return map
  })
  const [itemsByDocId, setItemsByDocId] = useState(initialItemsByDocId)

  async function handleDocumentProcessed(documentId: string) {
    setProcessedDocIds(prev => [documentId, ...prev.filter(id => id !== documentId)])

    // Fetch the processed doc and its extracted items
    const supabase = createClient()
    const [{ data: doc }, { data: items }] = await Promise.all([
      supabase
        .from('uploaded_documents')
        .select('*')
        .eq('id', documentId)
        .single(),
      supabase
        .from('knowledge_items')
        .select('*')
        .eq('is_active', true)
        .contains('source_document_ids', [documentId]),
    ])

    if (doc) {
      setLoadedDocs(prev => ({ ...prev, [documentId]: doc as UploadedDocument }))
    }
    if (items) {
      setItemsByDocId(prev => ({ ...prev, [documentId]: items as KnowledgeItem[] }))
    }
  }

  return (
    <div className="space-y-8">
      <UploadZone onDocumentProcessed={handleDocumentProcessed} />

      {/* Review sections for newly processed documents */}
      {processedDocIds.map(docId => {
        const doc = loadedDocs[docId]
        const items = itemsByDocId[docId] ?? []
        if (!doc) return null
        return (
          <ExtractedItemsReview
            key={docId}
            documentName={doc.filename}
            documentType={doc.document_type ?? 'document'}
            items={items}
          />
        )
      })}
    </div>
  )
}
