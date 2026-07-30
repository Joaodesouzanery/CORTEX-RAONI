import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { importInitSchema, formatZodError } from '@/lib/validation'
import { refreshImportBatch } from '@/lib/import/batches'

export const dynamic = 'force-dynamic'

type StoredDocument = {
  id: string
  storage_path: string
  status: string
  [key: string]: unknown
}

async function prepareExistingDocument(
  supabase: ReturnType<typeof createClient>,
  document: StoredDocument,
  filename: string,
  batchId?: string
) {
  if (batchId) {
    const { data: currentLink } = await supabase
      .from('import_batch_documents')
      .select('status')
      .eq('batch_id', batchId)
      .eq('document_id', document.id)
      .maybeSingle()
    const alreadyProcessed = currentLink?.status === 'complete' || currentLink?.status === 'review'
    if (alreadyProcessed) {
      return { duplicate: true, already_processed: true, document }
    }

    await supabase.from('import_batch_documents').upsert(
      {
        batch_id: batchId,
        document_id: document.id,
        filename,
        status: document.status === 'concluido' || document.status === 'revisao' ? 'pending' : 'uploading',
        error: null,
      },
      { onConflict: 'batch_id,document_id' }
    )
    await refreshImportBatch(supabase, batchId)
  }

  if (document.status === 'concluido' || document.status === 'revisao') {
    return { duplicate: true, already_processed: false, document }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('source-documents')
    .createSignedUploadUrl(document.storage_path, { upsert: true })
  if (signError || !signed) {
    const message = signError?.message || 'Falha ao assinar retomada do upload'
    await supabase.from('source_documents').update({ status: 'erro', error: message }).eq('id', document.id)
    if (batchId) {
      await supabase
        .from('import_batch_documents')
        .update({ status: 'error', error: message })
        .eq('batch_id', batchId)
        .eq('document_id', document.id)
      await refreshImportBatch(supabase, batchId)
    }
    throw new Error(message)
  }

  const { data: resumedDocument } = await supabase
    .from('source_documents')
    .update({ status: 'enviado', error: null })
    .eq('id', document.id)
    .select()
    .single()

  return {
    duplicate: false,
    resumed: true,
    document: resumedDocument || document,
    upload: { path: document.storage_path, token: signed.token, upsert: true },
  }
}

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('source_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = importInitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { filename, sha256, batch_id } = parsed.data

  if (batch_id) {
    const { data: batch } = await supabase.from('import_batches').select('id').eq('id', batch_id).maybeSingle()
    if (!batch) return NextResponse.json({ error: 'Lote de importação não encontrado.' }, { status: 404 })
  }

  const { data: existing } = await supabase
    .from('source_documents')
    .select('*')
    .eq('sha256', sha256.toLowerCase())
    .maybeSingle()
  if (existing) {
    try {
      return NextResponse.json(
        await prepareExistingDocument(supabase, existing as StoredDocument, filename, batch_id)
      )
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Falha ao retomar upload.' },
        { status: 500 }
      )
    }
  }

  const safeName = filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
  const now = new Date()
  const prefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const id = crypto.randomUUID()
  const storagePath = `${prefix}/${id}-${safeName || 'documento'}`

  const { data: document, error: insertError } = await supabase
    .from('source_documents')
    .insert({
      id,
      filename,
      storage_path: storagePath,
      sha256: sha256.toLowerCase(),
      status: 'enviado',
    })
    .select()
    .single()
  if (insertError?.code === '23505') {
    const { data: duplicate } = await supabase
      .from('source_documents')
      .select('*')
      .eq('sha256', sha256.toLowerCase())
      .single()
    if (duplicate) {
      try {
        return NextResponse.json(
          await prepareExistingDocument(supabase, duplicate as StoredDocument, filename, batch_id)
        )
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Falha ao retomar upload.' },
          { status: 500 }
        )
      }
    }
  }
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  if (batch_id) {
    const { error: batchDocumentError } = await supabase.from('import_batch_documents').insert({
      batch_id,
      document_id: id,
      filename,
      status: 'uploading',
    })
    if (batchDocumentError) {
      return NextResponse.json({ error: batchDocumentError.message }, { status: 500 })
    }
    await refreshImportBatch(supabase, batch_id)
  }

  const { data: signed, error: signError } = await supabase.storage
    .from('source-documents')
    .createSignedUploadUrl(storagePath)
  if (signError || !signed) {
    await supabase
      .from('source_documents')
      .update({ status: 'erro', error: signError?.message || 'Falha ao assinar upload' })
      .eq('id', id)
    if (batch_id) {
      await supabase
        .from('import_batch_documents')
        .update({ status: 'error', error: signError?.message || 'Falha ao assinar upload' })
        .eq('batch_id', batch_id)
        .eq('document_id', id)
      await refreshImportBatch(supabase, batch_id)
    }
    return NextResponse.json({ error: signError?.message || 'Falha ao preparar upload' }, { status: 500 })
  }

  return NextResponse.json(
    {
      duplicate: false,
      document,
      upload: { path: storagePath, token: signed.token, upsert: false },
    },
    { status: 201 }
  )
}
