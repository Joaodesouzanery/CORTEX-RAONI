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
import { parseHtmlReferenceReport, type ParsedReferenceEvidence } from '@/lib/import/html-report'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Batch = {
  id: string
  client_id: string
  client_ids: string[]
  period_month: string
  intent: 'noticias' | 'relatorio_referencia'
}

function missingManualIntakeColumn(message?: string) {
  return Boolean(message?.includes('manual_intake') || message?.includes('manual_received_at'))
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
  const { data: selectedClients, error: selectedClientsError } = await supabase
    .from('import_batch_clients')
    .select('client_id')
    .eq('batch_id', requestedBatchId)
  if (selectedClientsError) throw new Error(selectedClientsError.message)
  return {
    ...data,
    client_ids: selectedClients?.length ? selectedClients.map((row) => row.client_id) : [data.client_id],
  } as Batch
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
  const receivedAt = new Date().toISOString()
  for (const clientId of batch.client_ids) {
    for (const article of articles) {
      const { error: assignmentError } = await supabase.from('article_period_assignments').upsert(
        {
          article_id: article.id,
          client_id: clientId,
          period_month: batch.period_month,
          source_document_id: documentId,
        },
        { onConflict: 'article_id,client_id,period_month,source_document_id' }
      )
      if (assignmentError) throw new Error(assignmentError.message)

      const selectedTagResult = await supabase
        .from('article_client_tags')
        .select('article_id, manual_received_at')
        .eq('article_id', article.id)
        .eq('client_id', clientId)
        .maybeSingle()
      let selectedTag = selectedTagResult.data
      let supportsManualIntake = true
      if (missingManualIntakeColumn(selectedTagResult.error?.message)) {
        supportsManualIntake = false
        const fallback = await supabase
          .from('article_client_tags')
          .select('article_id')
          .eq('article_id', article.id)
          .eq('client_id', clientId)
          .maybeSingle()
        if (fallback.error) throw new Error(fallback.error.message)
        selectedTag = fallback.data ? { ...fallback.data, manual_received_at: null } : null
      } else if (selectedTagResult.error) {
        throw new Error(selectedTagResult.error.message)
      }
      if (!selectedTag) {
        const { error: tagError } = await supabase.from('article_client_tags').insert({
          article_id: article.id,
          client_id: clientId,
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
          central_message: article.excerpt || article.title,
          strategic_effect: 'informativo',
          recommended_action: 'Revisar a aderência desta publicação antes do fechamento.',
          verification_status: 'pendente',
          source_verification_status:
            article.content_status === 'integral' ? 'documento_integral' : 'parcial',
          editorial_review_state: 'pendente',
          ...(supportsManualIntake
            ? { manual_intake: true, manual_received_at: receivedAt }
            : {}),
          qualification_version: 1,
        })
        if (tagError) throw new Error(tagError.message)
      } else if (supportsManualIntake) {
        const { error: tagError } = await supabase
          .from('article_client_tags')
          .update({
            manual_intake: true,
            manual_received_at: selectedTag.manual_received_at || receivedAt,
          })
          .eq('article_id', article.id)
          .eq('client_id', clientId)
        if (tagError) throw new Error(tagError.message)
      }
    }
  }

  if (articles.length) {
    const { data: drafts } = await supabase
      .from('monthly_report_drafts')
      .select('id')
      .in('client_id', batch.client_ids)
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

async function saveReferenceEvidence(
  supabase: ReturnType<typeof createClient>,
  batch: Batch,
  documentId: string,
  referenceReportId: string,
  evidence: ParsedReferenceEvidence[],
  importSourceId: string
) {
  const articles: Article[] = []
  for (const item of evidence) {
    const article = await findOrSaveArticle(
      supabase,
      {
        title: item.title,
        publisher: item.publisher,
        author: item.author,
        published_at: item.published_at,
        url: null,
        excerpt: item.title,
        content: item.title,
        content_status: 'metadados',
        page_start: 1,
        page_end: 1,
      },
      documentId,
      importSourceId
    )
    articles.push(article)
    const score = item.relevance === 'alta' ? 90 : item.relevance === 'baixa' ? 45 : 70
    for (const clientId of batch.client_ids) {
      await supabase.from('article_client_tags').upsert(
        {
          article_id: article.id,
          client_id: clientId,
          tom: item.tone || 'neutro',
          relevancia: item.relevance || 'media',
          tema: 'Base histórica qualificada',
          classification_source: 'humano',
          confidence: 1,
          impact_summary: 'Publicação selecionada na base qualificada do relatório mensal entregue.',
          monitoring_status: 'confirmado',
          report_role: 'evidencia',
          editorial_score: score,
          editorial_reason: 'Decisão editorial humana recuperada do relatório de referência.',
          cluster_label: 'Base histórica do relatório',
          report_role_source: 'humano',
          triaged_at: new Date().toISOString(),
          triage_version: 1,
          central_message: item.title,
          strategic_effect: 'informativo',
          recommended_action: 'Usar como evidência histórica e revisar a leitura estratégica quando necessário.',
          verification_status: 'parcial',
          source_verification_status: 'parcial',
          editorial_review_state: 'revisado',
          qualified_at: new Date().toISOString(),
          qualification_version: 1,
        },
        { onConflict: 'article_id,client_id' }
      )
      await supabase.from('article_period_assignments').upsert(
        {
          article_id: article.id,
          client_id: clientId,
          period_month: batch.period_month,
          source_document_id: documentId,
        },
        { onConflict: 'article_id,client_id,period_month,source_document_id' }
      )
    }
    await supabase.from('reference_report_items').upsert(
      {
        reference_report_id: referenceReportId,
        row_number: item.row_number,
        article_id: article.id,
        match_status: article.content_status === 'metadados' ? 'created' : 'linked',
        original_snapshot: item,
        classification_snapshot: {
          tom: item.tone || 'neutro',
          relevancia: item.relevance || 'media',
          report_role: 'evidencia',
          source: 'humano',
        },
        match_confidence: article.content_status === 'metadados' ? 0.7 : 1,
        reconciled_at: new Date().toISOString(),
      },
      { onConflict: 'reference_report_id,row_number' }
    )
  }
  const { data: drafts } = await supabase
    .from('monthly_report_drafts')
    .select('id')
    .in('client_id', batch.client_ids)
    .eq('period_month', batch.period_month)
    .neq('status', 'approved')
  const draftIds = (drafts || []).map((draft) => draft.id)
  if (draftIds.length) {
    const updatedAt = new Date().toISOString()
    await Promise.all([
      supabase
        .from('monthly_report_drafts')
        .update({ status: 'stale', updated_at: updatedAt })
        .in('id', draftIds),
      supabase
        .from('report_sections')
        .update({ status: 'stale', updated_at: updatedAt })
        .in('draft_id', draftIds)
        .in('status', ['generated', 'edited']),
    ])
  }
  return articles
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
    if (
      document.status === 'concluido' &&
      batch &&
      batch.intent === 'noticias' &&
      !/\.html?$/i.test(document.filename)
    ) {
      const { data: provenance } = await supabase
        .from('article_provenance')
        .select('articles(*)')
        .eq('source_document_id', id)
      const articles = (provenance || [])
        .map((row) => row.articles)
        .filter(Boolean) as unknown as Article[]
      await attachBatchArticles(supabase, batch, id, articles)
      const reuseNeedsReview = articles.length === 0
      await supabase
        .from('import_batch_documents')
        .update({
          status: reuseNeedsReview ? 'review' : 'complete',
          article_count: articles.length,
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
    if (downloadError || !file) throw new Error(downloadError?.message || 'Não foi possível baixar o documento.')
    const bytes = new Uint8Array(await file.arrayBuffer())

    if (/\.html?$/i.test(document.filename)) {
      if (!batch || batch.intent !== 'relatorio_referencia') {
        throw new Error('Relatórios HTML devem ser enviados com a finalidade "Relatório anterior".')
      }
      const parsedHtml = parseHtmlReferenceReport(bytes, document.filename)
      const { data: importSource, error: sourceError } = await supabase
        .from('sources')
        .select('id')
        .eq('url', 'https://cortex.invalid/documentos-importados')
        .single()
      if (sourceError || !importSource) throw new Error('Aplique a migration 023 antes de importar documentos.')

      let articleCount = 0
      for (const clientId of batch.client_ids) {
        const { data: reference, error: referenceError } = await supabase
          .from('reference_reports')
          .upsert(
            {
              client_id: clientId,
              period_month: batch.period_month,
              source_document_id: id,
              title: parsedHtml.title,
              extracted_text: parsedHtml.extractedText,
              status: 'ready',
              metadata: parsedHtml.metadata,
            },
            { onConflict: 'client_id,period_month,source_document_id' }
          )
          .select()
          .single()
        if (referenceError || !reference) throw new Error(referenceError?.message || 'Falha ao salvar referência.')
        // A reconstrução ocorre uma vez por relatório/cliente. O helper também
        // garante todos os vínculos escolhidos; as operações são idempotentes.
        const saved = await saveReferenceEvidence(
          supabase,
          { ...batch, client_ids: [clientId] },
          id,
          reference.id,
          parsedHtml.evidence,
          importSource.id
        )
        articleCount = Math.max(articleCount, saved.length)
      }
      const { data: updated, error: updateError } = await supabase
        .from('source_documents')
        .update({
          document_type: 'relatorio',
          status: parsedHtml.evidence.length ? 'concluido' : 'revisao',
          imported_article_count: articleCount,
          metadata: parsedHtml.metadata,
          processed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()
      if (updateError) throw new Error(updateError.message)
      await supabase
        .from('import_batch_documents')
        .update({
          status: parsedHtml.evidence.length ? 'complete' : 'review',
          article_count: articleCount,
          processed_at: new Date().toISOString(),
        })
        .eq('batch_id', batch.id)
        .eq('document_id', id)
      const updatedBatch = await refreshImportBatch(supabase, batch.id)
      return NextResponse.json({
        document: updated,
        articles: articleCount,
        reference: true,
        evidence_rows: parsedHtml.evidence.length,
        batch: updatedBatch,
      })
    }

    const parsed = applyStoredOcr(
      await parsePdf(bytes, document.filename),
      document
    )
    const treatAsReference = batch?.intent === 'relatorio_referencia' || parsed.documentType === 'relatorio'

    if (treatAsReference) {
      if (batch) {
        const extractedText =
          parsed.referenceText || parsed.articles.map((article) => article.content).filter(Boolean).join('\n\n')
        for (const clientId of batch.client_ids) {
          await supabase.from('reference_reports').upsert(
            {
              client_id: clientId,
              period_month: batch.period_month,
              source_document_id: id,
              title: document.filename.replace(/\.(pdf|html?)$/i, ''),
              extracted_text: extractedText || null,
              status: extractedText ? 'ready' : 'ocr_pending',
              metadata: {
                ...parsed.metadata,
                detected_type: parsed.documentType,
                reference_purpose: 'estrutura_e_qualidade',
                factual_evidence: false,
              },
            },
            { onConflict: 'client_id,period_month,source_document_id' }
          )
        }
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
