import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { canonicalArticleFingerprint, cleanArticleText, sameImportedPublication } from '@/lib/archive'
import { parsePdf } from '@/lib/import/pdf-parser'
import { normalizeText } from '@/lib/relevance'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: document, error: documentError } = await supabase
    .from('source_documents')
    .select('*')
    .eq('id', id)
    .single()
  if (documentError || !document) {
    return NextResponse.json({ error: documentError?.message || 'Importação não encontrada.' }, { status: 404 })
  }
  if (document.status === 'concluido') {
    return NextResponse.json({ document, duplicate: true })
  }

  await supabase.from('source_documents').update({ status: 'processando', error: null }).eq('id', id)
  try {
    const { data: file, error: downloadError } = await supabase.storage
      .from('source-documents')
      .download(document.storage_path)
    if (downloadError || !file) throw new Error(downloadError?.message || 'Não foi possível baixar o PDF.')

    const parsed = await parsePdf(new Uint8Array(await file.arrayBuffer()), document.filename)
    const { data: importSource, error: sourceError } = await supabase
      .from('sources')
      .select('id')
      .eq('url', 'https://cortex.invalid/documentos-importados')
      .single()
    if (sourceError || !importSource)
      throw new Error('A fonte "Documentos importados" não existe. Aplique a migration 023.')

    let imported = 0
    for (const item of parsed.articles) {
      const fingerprint = await canonicalArticleFingerprint(item)
      let existing: Article | null = null
      const { data: byFingerprint } = await supabase
        .from('articles')
        .select('*')
        .eq('canonical_fingerprint', fingerprint)
        .order('fetched_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      existing = byFingerprint as unknown as Article | null
      if (!existing && item.url) {
        const { data: byUrl } = await supabase.from('articles').select('*').eq('url', item.url).maybeSingle()
        existing = byUrl as unknown as Article | null
      }
      if (!existing && item.published_at) {
        const day = item.published_at.slice(0, 10)
        const start = `${day}T00:00:00.000Z`
        const end = new Date(new Date(start).getTime() + 86400000).toISOString()
        const { data: sameHeadline } = await supabase
          .from('articles')
          .select('*')
          .eq('title', item.title)
          .gte('published_at', start)
          .lt('published_at', end)
          .limit(10)
        existing =
          ((sameHeadline as unknown as Article[] | null) || []).find((candidate) => {
            const publisher = normalizeText(item.publisher || '')
            const samePublisher = publisher.length > 0 && normalizeText(candidate.publisher || '') === publisher
            const importedCopy = candidate.source_id === importSource.id && sameImportedPublication(candidate, item)
            return samePublisher || importedCopy
          }) || null
      }

      let articleId: string
      if (existing) {
        articleId = existing.id
        const oldText = cleanArticleText(existing.content)
        const patch: Record<string, unknown> = {
          canonical_fingerprint: existing.canonical_fingerprint || fingerprint,
          publisher: existing.publisher || item.publisher,
          author: existing.author || item.author,
          published_at: existing.published_at || item.published_at,
          excerpt: existing.excerpt || item.excerpt,
          url: existing.url || item.url,
        }
        if (item.content.length > oldText.length) {
          patch.content = item.content
          patch.content_status = item.content_status
        }
        const { error } = await supabase.from('articles').update(patch).eq('id', articleId)
        if (error) throw new Error(error.message)
      } else {
        const { data: inserted, error } = await supabase
          .from('articles')
          .insert({
            source_id: importSource.id,
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
          .select('id')
          .single()
        if (error || !inserted) throw new Error(error?.message || 'Falha ao salvar matéria importada.')
        articleId = inserted.id
      }

      const { data: existingProvenance } = await supabase
        .from('article_provenance')
        .select('id')
        .eq('article_id', articleId)
        .eq('source_document_id', document.id)
        .maybeSingle()
      if (!existingProvenance) {
        const { error: provenanceError } = await supabase.from('article_provenance').insert({
          article_id: articleId,
          source_document_id: document.id,
          source_id: importSource.id,
          acquisition_type: 'pdf',
          page_start: item.page_start,
          page_end: item.page_end,
          original_reference: item.url,
        })
        if (provenanceError) throw new Error(provenanceError.message)
      }
      imported++
    }

    const status = parsed.articles.length > 0 && parsed.documentType !== 'desconhecido' ? 'concluido' : 'revisao'
    const metadata = { ...parsed.metadata, warnings: parsed.warnings }
    const { data: updated, error: updateError } = await supabase
      .from('source_documents')
      .update({
        document_type: parsed.documentType,
        status,
        page_count: parsed.pageCount,
        imported_article_count: imported,
        metadata,
        processed_at: new Date().toISOString(),
      })
      .eq('id', document.id)
      .select()
      .single()
    if (updateError) throw new Error(updateError.message)
    return NextResponse.json({ document: updated, articles: imported, warnings: parsed.warnings })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar PDF.'
    await supabase
      .from('source_documents')
      .update({ status: 'erro', error: message, processed_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
