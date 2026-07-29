import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { canonicalArticleFingerprint, cleanArticleText, inferContentStatus, sameImportedPublication } from '@/lib/archive'
import {
  looksLikeReferenceReport,
  parsePdf,
  type ParsedPdfArticle,
  type ParsedPdfDocument,
} from '@/lib/import/pdf-parser'
import { normalizeText } from '@/lib/relevance'
import { classifyArticleBatch } from '@/lib/classification'
import { refreshImportBatch } from '@/lib/import/batches'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Batch = {
  id: string
  client_id: string
  period_month: string
  intent: 'noticias' | 'relatorio_referencia'
}

function applyStoredOcr(parsed: ParsedPdfDocument, document: Record<string, unknown>): ParsedPdfDocument {
  const ocrText = typeof document.ocr_text === 'string' ? cleanArticleText(document.ocr_text) : ''
  if (parsed.articles.length || !ocrText) return parsed
  const pageCount = parsed.pageCount || Number(document.page_count) || 1
  if (looksLikeReferenceReport(ocrText)) {
    return {
      ...parsed,
      documentType: 'relatorio',
      referenceText: ocrText,
      warnings: ['Relatório reconhecido após OCR; nenhuma notícia foi criada.'],
    }
  }
  if (pageCount > 4) {
    return {
      ...parsed,
      warnings: [
        ...parsed.warnings,
        'OCR concluído, mas o documento possui várias páginas sem estrutura separável; preservado para revisão.',
      ],
    }
  }
  const filename = String(document.filename || 'Matéria importada')
  const title =
    ocrText
      .split('\n')
      .map((line) => line.replace(/^#+\s*/, '').trim())
      .find((line) => line.length >= 10 && line.length <= 300) || filename.replace(/\.pdf$/i, '')
  return {
    ...parsed,
    documentType: 'artigo',
    articles: [
      {
        title,
        publisher: null,
        author: null,
        published_at: null,
        url: null,
        excerpt: ocrText.slice(0, 500),
        content: ocrText,
        content_status: inferContentStatus(ocrText),
        page_start: 1,
        page_end: pageCount,
      },
    ],
    warnings: ['Matéria individual extraída por OCR; data e veículo aguardam revisão.'],
  }
}

async function resolveBatch(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  requestedBatchId: string | null
): Promise<Batch | null> {
  if (!requestedBatchId) return null
  const { data } = await supabase
    .from('import_batches')
    .select('id, client_id, period_month, intent')
    .eq('id', requestedBatchId)
    .single()
  if (!data) throw new Error('Lote de importação não encontrado.')
  const { data: link } = await supabase
    .from('import_batch_documents')
    .select('document_id')
    .eq('batch_id', requestedBatchId)
    .eq('document_id', documentId)
    .maybeSingle()
  if (!link) throw new Error('O documento não pertence a este lote.')
  return data as Batch
}

async function findOrSaveArticle(
  supabase: ReturnType<typeof createClient>,
  item: ParsedPdfArticle,
  documentId: string,
  importSourceId: string
): Promise<Article> {
  const fingerprint = await canonicalArticleFingerprint(item)
  let existing: Article | null = null
  const { data: byFingerprint } = await supabase
    .from('articles')
    .select('*')
    .eq('canonical_fingerprint', fingerprint)
    .order('fetched_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  existing = byFingerprint as Article | null
  if (!existing && item.url) {
    const { data } = await supabase.from('articles').select('*').eq('url', item.url).maybeSingle()
    existing = data as Article | null
  }
  if (!existing && item.published_at) {
    const day = item.published_at.slice(0, 10)
    const start = `${day}T00:00:00.000Z`
    const end = new Date(new Date(start).getTime() + 86_400_000).toISOString()
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('title', item.title)
      .gte('published_at', start)
      .lt('published_at', end)
      .limit(10)
    existing =
      ((data as Article[] | null) || []).find((candidate) => {
        const publisher = normalizeText(item.publisher || '')
        return (
          (publisher.length > 0 && normalizeText(candidate.publisher || '') === publisher) ||
          (candidate.source_id === importSourceId && sameImportedPublication(candidate, item))
        )
      }) || null
  }

  let article: Article
  if (existing) {
    const patch: Record<string, unknown> = {
      canonical_fingerprint: existing.canonical_fingerprint || fingerprint,
      publisher: existing.publisher || item.publisher,
      author: existing.author || item.author,
      published_at: existing.published_at || item.published_at,
      excerpt: existing.excerpt || item.excerpt,
      url: existing.url || item.url,
    }
    if (item.content.length > cleanArticleText(existing.content).length) {
      patch.content = item.content
      patch.content_status = item.content_status
    }
    const { data, error } = await supabase.from('articles').update(patch).eq('id', existing.id).select().single()
    if (error || !data) throw new Error(error?.message || 'Falha ao enriquecer matéria.')
    article = data as Article
  } else {
    const { data, error } = await supabase
      .from('articles')
      .insert({
        source_id: importSourceId,
        title: item.title,
        url: item.url,
        image_url: null,
        excerpt: item.excerpt,
        content: item.content,
        content_status: item.content_status,
        author: item.author,
        publisher: item.publisher,
        published_at: item.published_at,
        canonical_fingerprint: fingerprint,
      })
      .select()
      .single()
    if (error || !data) throw new Error(error?.message || 'Falha ao salvar matéria importada.')
    article = data as Article
  }

  const { data: provenance } = await supabase
    .from('article_provenance')
    .select('id')
    .eq('article_id', article.id)
    .eq('source_document_id', documentId)
    .maybeSingle()
  if (!provenance) {
    const { error } = await supabase.from('article_provenance').insert({
      article_id: article.id,
      source_document_id: documentId,
      source_id: importSourceId,
      acquisition_type: 'pdf',
      page_start: item.page_start,
      page_end: item.page_end,
      original_reference: item.url,
    })
    if (error) throw new Error(error.message)
  }
  return article
}

async function attachBatchArticles(
  supabase: ReturnType<typeof createClient>,
  batch: Batch,
  documentId: string,
  articles: Article[]
) {
  if (articles.length) await classifyArticleBatch(supabase, articles)
  for (const article of articles) {
    const { error: assignmentError } = await supabase.from('article_period_assignments').upsert(
      {
        article_id: article.id,
        client_id: batch.client_id,
        period_month: batch.period_month,
        source_document_id: documentId,
      },
      { onConflict: 'article_id,client_id,period_month,source_document_id' }
    )
    if (assignmentError) throw new Error(assignmentError.message)

    const { data: selectedTag } = await supabase
      .from('article_client_tags')
      .select('article_id')
      .eq('article_id', article.id)
      .eq('client_id', batch.client_id)
      .maybeSingle()
    if (!selectedTag) {
      const { error: tagError } = await supabase.from('article_client_tags').insert({
        article_id: article.id,
        client_id: batch.client_id,
        tom: 'neutro',
        relevancia: 'baixa',
        cita_cliente: false,
        tema: 'Importação editorial',
        classification_source: 'regra',
        confidence: 0,
        impact_summary: 'Importada para este cliente e aguardando revisão editorial.',
        monitoring_status: 'revisao',
        match_score: 0,
        match_reasons: [],
        rule_version: 1,
        classified_at: new Date().toISOString(),
        report_role: 'contexto',
        editorial_score: 25,
        editorial_reason: 'Vínculo garantido pelo lote; regra contextual não confirmou relevância.',
        report_role_source: 'regra',
        triage_version: 1,
      })
      if (tagError) throw new Error(tagError.message)
    }
  }

  if (articles.length) {
    const { data: drafts } = await supabase
      .from('monthly_report_drafts')
      .select('id')
      .eq('client_id', batch.client_id)
      .eq('period_month', batch.period_month)
      .neq('status', 'approved')
    const ids = (drafts || []).map((draft) => draft.id)
    if (ids.length) {
      await supabase
        .from('monthly_report_drafts')
        .update({ status: 'stale', updated_at: new Date().toISOString() })
        .in('id', ids)
      await supabase
        .from('report_sections')
        .update({ status: 'stale', updated_at: new Date().toISOString() })
        .in('draft_id', ids)
        .in('status', ['generated', 'edited'])
    }
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const requestedBatchId = typeof body?.batch_id === 'string' ? body.batch_id : null
  const supabase = createClient()
  const { data: document, error: documentError } = await supabase
    .from('source_documents')
    .select('*')
    .eq('id', id)
    .single()
  if (documentError || !document) {
    return NextResponse.json({ error: documentError?.message || 'Importação não encontrada.' }, { status: 404 })
  }

  let batch: Batch | null = null
  try {
    batch = await resolveBatch(supabase, id, requestedBatchId)
    if (batch) {
      await supabase
        .from('import_batch_documents')
        .update({ status: 'processing', error: null })
        .eq('batch_id', batch.id)
        .eq('document_id', id)
      await refreshImportBatch(supabase, batch.id)
    }

    // Um SHA já processado pode entrar em outra competência. Reutilizamos as
    // proveniências, sem duplicar o artigo nem o arquivo.
    if (document.status === 'concluido' && batch) {
      const { data: provenance } = await supabase
        .from('article_provenance')
        .select('articles(*)')
        .eq('source_document_id', id)
      const articles = (provenance || [])
        .map((row) => row.articles)
        .filter(Boolean) as unknown as Article[]
      if (batch.intent === 'noticias') {
        await attachBatchArticles(supabase, batch, id, articles)
      } else {
        await supabase.from('reference_reports').upsert(
          {
            client_id: batch.client_id,
            period_month: batch.period_month,
            source_document_id: id,
            title: document.filename.replace(/\.pdf$/i, ''),
            extracted_text: document.ocr_text || null,
            status: document.ocr_text ? 'ready' : 'ocr_pending',
            metadata: { reused: true, detected_type: document.document_type },
          },
          { onConflict: 'client_id,period_month,source_document_id' }
        )
      }
      const reuseNeedsReview =
        batch.intent === 'relatorio_referencia' ? !document.ocr_text : articles.length === 0
      await supabase
        .from('import_batch_documents')
        .update({
          status: reuseNeedsReview ? 'review' : 'complete',
          article_count: batch.intent === 'noticias' ? articles.length : 0,
          processed_at: new Date().toISOString(),
        })
        .eq('batch_id', batch.id)
        .eq('document_id', id)
      const updatedBatch = await refreshImportBatch(supabase, batch.id)
      return NextResponse.json({ document, articles: articles.length, batch: updatedBatch, reused: true })
    }

    await supabase.from('source_documents').update({ status: 'processando', error: null }).eq('id', id)
    const { data: file, error: downloadError } = await supabase.storage
      .from('source-documents')
      .download(document.storage_path)
    if (downloadError || !file) throw new Error(downloadError?.message || 'Não foi possível baixar o PDF.')

    const parsed = applyStoredOcr(
      await parsePdf(new Uint8Array(await file.arrayBuffer()), document.filename),
      document
    )
    const treatAsReference = batch?.intent === 'relatorio_referencia' || parsed.documentType === 'relatorio'

    if (treatAsReference) {
      if (batch) {
        const extractedText =
          parsed.referenceText || parsed.articles.map((article) => article.content).filter(Boolean).join('\n\n')
        await supabase.from('reference_reports').upsert(
          {
            client_id: batch.client_id,
            period_month: batch.period_month,
            source_document_id: id,
            title: document.filename.replace(/\.pdf$/i, ''),
            extracted_text: extractedText || null,
            status: extractedText ? 'ready' : 'ocr_pending',
            metadata: { ...parsed.metadata, detected_type: parsed.documentType },
          },
          { onConflict: 'client_id,period_month,source_document_id' }
        )
      }
      const noText = !(parsed.referenceText || parsed.articles.some((article) => article.content))
      const { data: updated } = await supabase
        .from('source_documents')
        .update({
          document_type: 'relatorio',
          status: noText ? 'revisao' : 'concluido',
          page_count: parsed.pageCount,
          imported_article_count: 0,
          metadata: { ...parsed.metadata, warnings: parsed.warnings },
          ocr_status: noText ? 'pending' : document.ocr_status,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (batch) {
        await supabase
          .from('import_batch_documents')
          .update({
            status: noText ? 'review' : 'complete',
            article_count: 0,
            processed_at: new Date().toISOString(),
          })
          .eq('batch_id', batch.id)
          .eq('document_id', id)
        await refreshImportBatch(supabase, batch.id)
      }
      return NextResponse.json({
        document: updated,
        articles: 0,
        reference: true,
        ocr_required: noText,
        warnings: parsed.warnings,
      })
    }

    const { data: importSource, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('url', 'https://cortex.invalid/documentos-importados')
      .single()
    if (sourceError || !importSource) {
      throw new Error('A fonte "Documentos importados" não existe. Aplique a migration 023.')
    }

    const articles: Article[] = []
    for (const item of parsed.articles) {
      articles.push(await findOrSaveArticle(supabase, item, id, importSource.id))
    }
    if (batch) await attachBatchArticles(supabase, batch, id, articles)

    const status = parsed.articles.length > 0 && parsed.documentType !== 'desconhecido' ? 'concluido' : 'revisao'
    const { data: updated, error: updateError } = await supabase
      .from('source_documents')
      .update({
        document_type: parsed.documentType,
        status,
        page_count: parsed.pageCount,
        imported_article_count: articles.length,
        metadata: { ...parsed.metadata, warnings: parsed.warnings },
        processed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (updateError) throw new Error(updateError.message)

    if (batch) {
      await supabase
        .from('import_batch_documents')
        .update({
          status: status === 'concluido' ? 'complete' : 'review',
          article_count: articles.length,
          processed_at: new Date().toISOString(),
        })
        .eq('batch_id', batch.id)
        .eq('document_id', id)
      await refreshImportBatch(supabase, batch.id)
    }
    return NextResponse.json({ document: updated, articles: articles.length, warnings: parsed.warnings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar PDF.'
    await supabase
      .from('source_documents')
      .update({ status: 'erro', error: message, processed_at: new Date().toISOString() })
      .eq('id', id)
    if (batch) {
      await supabase
        .from('import_batch_documents')
        .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
        .eq('batch_id', batch.id)
        .eq('document_id', id)
      await refreshImportBatch(supabase, batch.id)
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
