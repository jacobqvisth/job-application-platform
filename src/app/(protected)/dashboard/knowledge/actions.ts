'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { extractTextFromFile } from '@/lib/knowledge/extract-text'
import { classifyDocument, extractKnowledgeFromDocument } from '@/lib/knowledge/ai-extraction'

// ─── Upload Document ──────────────────────────────────────

export async function uploadDocumentAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided')

  const sourceContext = formData.get('sourceContext') as string | null

  // Validate file type
  const allowedTypes = ['pdf', 'docx', 'txt', 'md', 'rtf']
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!allowedTypes.includes(ext)) {
    throw new Error(`Unsupported file type: .${ext}. Supported: ${allowedTypes.join(', ')}`)
  }

  // Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 10MB.')
  }

  // Upload to Supabase Storage
  const buffer = Buffer.from(await file.arrayBuffer())
  const storagePath = `${user.id}/${crypto.randomUUID()}/${file.name}`

  const { error: storageError } = await supabase.storage
    .from('knowledge-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (storageError) throw new Error(`Upload failed: ${storageError.message}`)

  // Create DB record
  const { data: doc, error: dbError } = await supabase
    .from('uploaded_documents')
    .insert({
      user_id: user.id,
      filename: file.name,
      file_type: ext,
      file_size: file.size,
      storage_path: storagePath,
      processing_status: 'pending',
      source_context: sourceContext || null,
    })
    .select()
    .single()

  if (dbError || !doc) throw new Error('Failed to save document record')

  revalidatePath('/dashboard/knowledge')
  return { documentId: doc.id }
}


// ─── Process Document (Extract Text → Classify → Extract Knowledge) ────

export async function processDocumentAction(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // Fetch document record
  const { data: doc } = await supabase
    .from('uploaded_documents')
    .select('*')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()

  if (!doc) throw new Error('Document not found')

  // Mark as processing
  await supabase
    .from('uploaded_documents')
    .update({ processing_status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', documentId)

  try {
    // Step 1: Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('knowledge-documents')
      .download(doc.storage_path)

    if (downloadError || !fileData) throw new Error('Failed to download file')

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // Step 2: Extract text
    const extractedText = await extractTextFromFile(buffer, doc.file_type)

    if (!extractedText || extractedText.trim().length < 20) {
      throw new Error('Could not extract meaningful text from this file')
    }

    // Step 3: Classify document type + generate summary
    const classification = await classifyDocument(extractedText, doc.filename)

    // Step 4: Get existing item titles for dedup context
    const { data: existingItems } = await supabase
      .from('knowledge_items')
      .select('title')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const existingTitles = (existingItems ?? []).map((i: { title: string }) => i.title)

    // Step 5: Extract knowledge items
    const extractedItems = await extractKnowledgeFromDocument(
      extractedText,
      classification.document_type,
      existingTitles
    )

    // Step 6: Save extracted items with confidence = 'ai_inferred'
    if (extractedItems.length > 0) {
      const itemsToInsert = extractedItems.map(item => ({
        user_id: user.id,
        category: item.category,
        subcategory: item.subcategory || null,
        title: item.title,
        content: item.content,
        structured_data: item.structured_data || {},
        tags: item.tags || [],
        confidence: 'ai_inferred' as const,
        source_type: 'document' as const,
        source_document_ids: [documentId],
      }))

      await supabase.from('knowledge_items').insert(itemsToInsert)
    }

    // Step 7: Update document record
    await supabase
      .from('uploaded_documents')
      .update({
        processing_status: 'completed',
        extracted_text: extractedText.slice(0, 50000),
        ai_summary: classification.summary,
        document_type: classification.document_type,
        extracted_item_count: extractedItems.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during processing'
    await supabase
      .from('uploaded_documents')
      .update({
        processing_status: 'failed',
        processing_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId)

    throw error
  }

  revalidatePath('/dashboard/knowledge')
}


// ─── Upload and Process (combined convenience action) ──────

export async function uploadAndProcessDocumentAction(formData: FormData) {
  const { documentId } = await uploadDocumentAction(formData)
  await processDocumentAction(documentId)
  return { documentId }
}


// ─── Knowledge Item Actions ───────────────────────────────

export async function confirmKnowledgeItemAction(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .update({
      confidence: 'user_confirmed',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}

export async function rejectKnowledgeItemAction(itemId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}

export async function updateKnowledgeItemAction(
  itemId: string,
  updates: {
    title?: string
    content?: string
    category?: string
    subcategory?: string | null
    tags?: string[]
    structured_data?: Record<string, unknown>
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .update({
      ...updates,
      confidence: 'user_confirmed',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}

export async function addKnowledgeItemAction(item: {
  category: string
  subcategory?: string | null
  title: string
  content: string
  tags?: string[]
  structured_data?: Record<string, unknown>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .insert({
      user_id: user.id,
      ...item,
      tags: item.tags || [],
      structured_data: item.structured_data || {},
      confidence: 'user_confirmed',
      source_type: 'manual',
    })

  revalidatePath('/dashboard/knowledge')
}

export async function bulkConfirmItemsAction(itemIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .update({
      confidence: 'user_confirmed',
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', itemIds)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}

export async function bulkRejectItemsAction(itemIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await supabase
    .from('knowledge_items')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in('id', itemIds)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}

export async function deleteDocumentAction(documentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: doc } = await supabase
    .from('uploaded_documents')
    .select('storage_path')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .single()

  if (!doc) throw new Error('Document not found')

  // Delete from storage
  await supabase.storage.from('knowledge-documents').remove([doc.storage_path])

  // Soft-delete linked knowledge items
  await supabase
    .from('knowledge_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .contains('source_document_ids', [documentId])

  // Delete document record
  await supabase
    .from('uploaded_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', user.id)

  revalidatePath('/dashboard/knowledge')
}
