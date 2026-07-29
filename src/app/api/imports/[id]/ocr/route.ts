import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { extractPdfWithAi } from '@/lib/import/ocr'
import { refreshImportBatch } from '@/lib/import/batches'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: document, error } = await supabase.from('source_documents').select('*').eq('id', id).single()
  if (error || !document) {
    return NextResponse.json({ error: error?.message || 'Documento não encontrado.' }, { status: 404 })
  }
  if (document.ocr_status === 'complete' && document.ocr_text) {
    return NextResponse.json({ document, reused: true })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    await supabase.from('source_documents').update({ ocr_status: 'pending' }).eq('id', id)
    return NextResponse.json(
      { error: 'OCR por IA indisponível: configure ANTHROPIC_API_KEY. O PDF original foi preservado.' },
      { status: 503 }
    )
  }

  await supabase.from('source_documents').update({ ocr_status: 'processing', error: null }).eq('id', id)
  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from('source-documents')
      .download(document.storage_path)
    if (downloadError || !file) throw new Error(downloadError?.message || 'Falha ao baixar o PDF.')
    if (file.size > 30 * 1024 * 1024) {
      throw new Error('O OCR por IA aceita PDFs de até 30 MB. O original foi preservado para conferência.')
    }
    const text = await extractPdfWithAi(new Uint8Array(await file.arrayBuffer()))
    if (!text) throw new Error('A IA não retornou texto pesquisável.')
    const { data: updated, error: updateError } = await supabase
      .from('source_documents')
      .update({
        ocr_status: 'complete',
        ocr_text: text,
        status: document.document_type === 'relatorio' ? 'concluido' : 'revisao',
        error: null,
      })
      .eq('id', id)
      .select()
      .single()
    if (updateError) throw new Error(updateError.message)
    await supabase
      .from('reference_reports')
      .update({ extracted_text: text, status: 'ready' })
      .eq('source_document_id', id)
    const { data: batchLinks } = await supabase
      .from('import_batch_documents')
      .select('batch_id')
      .eq('document_id', id)
      .eq('status', 'review')
    const reprocessBatchIds: string[] = []
    if (batchLinks?.length) {
      for (const link of batchLinks) {
        const { data: batch } = await supabase.from('import_batches').select('intent').eq('id', link.batch_id).single()
        if (batch?.intent === 'relatorio_referencia') {
          await supabase
            .from('import_batch_documents')
            .update({ status: 'complete', error: null, processed_at: new Date().toISOString() })
            .eq('batch_id', link.batch_id)
            .eq('document_id', id)
        } else if (batch?.intent === 'noticias') {
          reprocessBatchIds.push(link.batch_id)
        }
        await refreshImportBatch(supabase, link.batch_id)
      }
    }
    return NextResponse.json({ document: updated, reprocess_batch_ids: reprocessBatchIds })
  } catch (ocrError) {
    const message = ocrError instanceof Error ? ocrError.message : 'Falha no OCR.'
    await supabase.from('source_documents').update({ ocr_status: 'error', error: message }).eq('id', id)
    await supabase.from('reference_reports').update({ status: 'error' }).eq('source_document_id', id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
