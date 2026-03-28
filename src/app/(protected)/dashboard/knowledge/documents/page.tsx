import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUploadedDocuments } from '@/lib/data/knowledge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DeleteDocumentButton } from '@/components/knowledge/delete-document-button'
import { ChevronLeftIcon, FileTextIcon } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Documents | Knowledge Base',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function documentTypeLabel(type: string | null) {
  if (!type) return null
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">✅ Completed</Badge>
  if (status === 'processing') return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">🔄 Processing</Badge>
  if (status === 'failed') return <Badge variant="destructive" className="text-xs">❌ Failed</Badge>
  return <Badge variant="secondary" className="text-xs">⏳ Pending</Badge>
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const documents = await getUploadedDocuments(authData.user.id)

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
        <h1 className="text-xl font-semibold">Uploaded Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
        </p>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileTextIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            <Link
              href="/dashboard/knowledge/upload"
              className="inline-flex items-center mt-3 text-sm text-primary hover:underline"
            >
              Upload your first document →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map(doc => (
            <Card key={doc.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <FileTextIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm truncate">{doc.filename}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={doc.processing_status} />
                        <DeleteDocumentButton documentId={doc.id} filename={doc.filename} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {documentTypeLabel(doc.document_type) && (
                        <Badge variant="outline" className="text-xs">
                          {documentTypeLabel(doc.document_type)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                        {doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
                        {doc.processing_status === 'completed' ? ` · ${doc.extracted_item_count} items extracted` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {doc.ai_summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed pl-8 border-l-2 border-muted ml-0">
                    {doc.ai_summary}
                  </p>
                )}

                {doc.source_context && (
                  <p className="text-xs text-muted-foreground pl-8">
                    <span className="font-medium">Context:</span> {doc.source_context}
                  </p>
                )}

                {doc.processing_status === 'failed' && doc.processing_error && (
                  <p className="text-xs text-destructive pl-8">
                    Error: {doc.processing_error}
                  </p>
                )}

                {doc.processing_status === 'completed' && doc.extracted_item_count > 0 && (
                  <div className="pl-8">
                    <Link
                      href={`/dashboard/knowledge?search=${encodeURIComponent(doc.filename.split('.')[0])}`}
                      className="text-xs text-primary hover:underline"
                    >
                      View extracted items →
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
