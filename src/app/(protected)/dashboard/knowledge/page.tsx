import { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  getKnowledgeCategoryCounts,
  getUploadedDocuments,
  getPendingReviewItems,
  getKnowledgeItems,
  getKnowledgeProfileSummary,
  getPopularTags,
  KnowledgeCategory,
  ConfidenceLevel,
} from '@/lib/data/knowledge'
import { CategoryCompleteness } from '@/components/knowledge/category-completeness'
import { KnowledgeItemCard } from '@/components/knowledge/knowledge-item-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  UploadIcon,
  MicIcon,
  ChevronRightIcon,
  PlusIcon,
  FileTextIcon,
  BrainIcon,
} from 'lucide-react'
import { AddKnowledgeItemDialog } from '@/components/knowledge/add-knowledge-item-dialog'
import { ProfileSummaryCard } from '@/components/knowledge/profile-summary-card'
import { ImportProfileButton } from '@/components/knowledge/import-profile-button'

export const metadata: Metadata = {
  title: 'Knowledge Base | Job Platform',
  description: 'Your personal knowledge base',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function documentTypeLabel(type: string | null) {
  if (!type) return 'Document'
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function statusIcon(status: string) {
  if (status === 'completed') return '✅'
  if (status === 'processing') return '🔄'
  if (status === 'failed') return '❌'
  return '⏳'
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; confidence?: string; search?: string; page?: string; tag?: string }>
}) {
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getUser()
  if (!authData.user) redirect('/login')

  const params = await searchParams
  const userId = authData.user.id

  const [counts, documents, pendingItems, allItems, profileSummary, popularTags, profileData, importedCheck] = await Promise.all([
    getKnowledgeCategoryCounts(userId),
    getUploadedDocuments(userId),
    getPendingReviewItems(userId),
    getKnowledgeItems(userId, {
      category: params.category as KnowledgeCategory | undefined,
      confidence: params.confidence as ConfidenceLevel | undefined,
      isActive: true,
      search: params.search,
      tag: params.tag,
    }),
    getKnowledgeProfileSummary(userId),
    getPopularTags(userId),
    supabase
      .from('user_profile_data')
      .select('summary, work_history, education, skills')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('knowledge_items')
      .select('id')
      .eq('user_id', userId)
      .eq('source_type', 'profile_import')
      .limit(1),
  ])

  const recentDocs = documents.slice(0, 5)
  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0)

  const pd = profileData.data
  const hasProfileData = !!(
    (pd?.work_history as unknown[])?.length ||
    (pd?.skills as unknown[])?.length ||
    (pd?.education as unknown[])?.length ||
    pd?.summary
  )
  const hasAlreadyImported = (importedCheck.data?.length ?? 0) > 0
  const showImportButton = hasProfileData && !hasAlreadyImported

  // Pagination
  const page = parseInt(params.page ?? '1')
  const pageSize = 20
  const totalPages = Math.ceil(allItems.length / pageSize)
  const pageItems = allItems.slice((page - 1) * pageSize, page * pageSize)

  const activeFilters = !!(params.category || params.confidence || params.search || params.tag)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainIcon className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Your Knowledge Base</h1>
          {totalItems > 0 && (
            <Badge variant="secondary" className="text-xs">{totalItems} items</Badge>
          )}
        </div>
        <AddKnowledgeItemDialog>
          <Button size="sm" variant="outline" className="gap-1.5">
            <PlusIcon className="h-3.5 w-3.5" />
            Add Manually
          </Button>
        </AddKnowledgeItemDialog>
      </div>

      {/* Profile Summary */}
      <ProfileSummaryCard summary={profileSummary} />

      {/* Onboarding — shown when no items yet */}
      {totalItems === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8">
            <div className="text-center space-y-4">
              <BrainIcon className="h-12 w-12 text-muted-foreground/30 mx-auto" />
              <div>
                <h3 className="font-semibold">Build Your Knowledge Base</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your knowledge base is empty. Here&apos;s how to get started:
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 text-left max-w-xl mx-auto">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium">1. Import Profile Data</p>
                  <p className="text-xs text-muted-foreground">Seed your knowledge base from your existing profile in seconds</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium">2. Upload Documents</p>
                  <p className="text-xs text-muted-foreground">Add resumes, portfolios, or any professional documents</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium">3. Start an Interview</p>
                  <p className="text-xs text-muted-foreground">Answer guided questions to capture your experience in depth</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completeness */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Profile Completeness
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryCompleteness counts={counts} />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/knowledge/upload">
              <Button className="gap-2">
                <UploadIcon className="h-4 w-4" />
                Upload Documents
              </Button>
            </Link>
            <Link href="/dashboard/knowledge/interview">
              <Button variant="outline" className="gap-2">
                <MicIcon className="h-4 w-4" />
                Start Interview
              </Button>
            </Link>
            {showImportButton && <ImportProfileButton />}
          </div>
        </CardContent>
      </Card>

      {/* Pending Review */}
      {pendingItems.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-500">⚡</span>
                <p className="text-sm font-medium">
                  {pendingItems.length} item{pendingItems.length !== 1 ? 's' : ''} extracted from your documents need review
                </p>
              </div>
              <Link href="/dashboard/knowledge?confidence=ai_inferred">
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-amber-300 hover:bg-amber-100">
                  Review Now
                  <ChevronRightIcon className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Documents */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Recent Documents
          </CardTitle>
          <Link href="/dashboard/knowledge/documents" className="text-xs text-primary hover:underline">
            View All →
          </Link>
        </CardHeader>
        <CardContent>
          {recentDocs.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <FileTextIcon className="h-8 w-8 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              <Link href="/dashboard/knowledge/upload">
                <Button size="sm" variant="outline" className="mt-1">
                  Upload your first document
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDocs.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 py-1.5">
                  <span className="text-base">{statusIcon(doc.processing_status)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.processing_status === 'completed'
                        ? `${doc.extracted_item_count} items · ${formatDate(doc.created_at)}`
                        : doc.processing_status === 'processing'
                          ? 'Processing...'
                          : doc.processing_status === 'failed'
                            ? `Failed: ${doc.processing_error ?? 'Unknown error'}`
                            : `Pending · ${formatDate(doc.created_at)}`}
                    </p>
                  </div>
                  {doc.document_type && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {documentTypeLabel(doc.document_type)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Knowledge Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            All Knowledge Items
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Filters */}
          <form className="flex flex-wrap gap-2">
            <select
              name="category"
              defaultValue={params.category ?? ''}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">All Categories</option>
              <option value="fact">Facts</option>
              <option value="skill">Skills</option>
              <option value="achievement">Achievements</option>
              <option value="story">Stories</option>
              <option value="value">Values</option>
              <option value="preference">Preferences</option>
              <option value="philosophy">Philosophy</option>
              <option value="self_assessment">Self-Assessment</option>
            </select>
            <select
              name="confidence"
              defaultValue={params.confidence ?? ''}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">All Confidence</option>
              <option value="user_confirmed">Confirmed</option>
              <option value="ai_inferred">Needs Review</option>
              <option value="imported">Imported</option>
            </select>
            <input
              name="search"
              defaultValue={params.search ?? ''}
              placeholder="Search..."
              className="h-8 rounded-md border bg-background px-2 text-xs flex-1 min-w-32"
            />
            <Button type="submit" size="sm" variant="outline" className="h-8">
              Filter
            </Button>
            {activeFilters && (
              <Link href="/dashboard/knowledge">
                <Button size="sm" variant="ghost" className="h-8">Clear</Button>
              </Link>
            )}
          </form>

          {/* Popular Tags */}
          {popularTags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">Popular tags</p>
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map(({ tag }) => (
                  <Link key={tag} href={`/dashboard/knowledge?tag=${encodeURIComponent(tag)}`}>
                    <Badge
                      variant={params.tag === tag ? 'default' : 'secondary'}
                      className="text-xs cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Active tag indicator */}
          {params.tag && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filtering by tag:</span>
              <Badge variant="default" className="text-xs gap-1">
                {params.tag}
              </Badge>
              <Link href="/dashboard/knowledge">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs">×</Button>
              </Link>
            </div>
          )}

          {/* Items */}
          {pageItems.length === 0 ? (
            <div className="text-center py-8">
              <BrainIcon className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {totalItems === 0
                  ? 'Upload a document or start an interview to build your knowledge base.'
                  : 'No items match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pageItems.map(item => (
                <KnowledgeItemCard key={item.id} item={item} mode="manage" />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, allItems.length)} of {allItems.length}
              </p>
              <div className="flex gap-1">
                {page > 1 && (
                  <Link href={`/dashboard/knowledge?${new URLSearchParams({ ...params, page: String(page - 1) })}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">← Prev</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/dashboard/knowledge?${new URLSearchParams({ ...params, page: String(page + 1) })}`}>
                    <Button size="sm" variant="outline" className="h-7 text-xs">Next →</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
