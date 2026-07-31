import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { canonicalArticleFingerprint, cleanArticleText, inferContentStatus } from '@/lib/archive'
import { classifyArticleBatch } from '@/lib/classification'
import { refreshImportBatch } from '@/lib/import/batches'
import { formatZodError, importBatchItemsSchema } from '@/lib/validation'
import type { Article, ContentStatus } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type ManualArticle = {
  title: string
  url: string | null
  publisher: string | null
  author: string | null
  published_at: string | null
  excerpt: string
  content: string
  content_status: ContentStatus
}

type CheerioRoot = ReturnType<typeof cheerio.load>

function missingManualIntakeColumn(message?: string) {
  return Boolean(message?.includes('manual_intake') || message?.includes('manual_received_at'))
}

function meta($: CheerioRoot, ...selectors: string[]) {
  for (const selector of selectors) {
    const value = $(selector).first().attr('content')?.trim()
    if (value) return value
  }
  return null
}

async function articleFromUrl(url: string): Promise<ManualArticle> {
  let parsedUrl = new URL(url)
  let response: Response | null = null
  for (let redirect = 0; redirect < 4; redirect += 1) {
    await assertPublicUrl(parsedUrl)
    response = await fetch(parsedUrl.toString(), {
      headers: { 'User-Agent': 'CORTEX/1.0 (+monitoramento editorial autorizado)' },
      signal: AbortSignal.timeout(12_000),
      redirect: 'manual',
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (!location) break
    parsedUrl = new URL(location, parsedUrl)
  }
  if (!response) throw new Error('Não foi possível acessar a página.')
  if (!response.ok) throw new Error(`A página retornou HTTP ${response.status}.`)
  const html = await response.text()
  const $ = cheerio.load(html)
  $('script, style, nav, aside, footer, form, noscript, svg').remove()
  const title =
    meta($, 'meta[property="og:title"]', 'meta[name="twitter:title"]') ||
    cleanArticleText($('h1').first().text()) ||
    cleanArticleText($('title').first().text())
  if (!title) throw new Error('Não foi possível identificar o título da página.')
  const content = cleanArticleText(
    $('article').first().text() || $('[itemprop="articleBody"]').first().text() || $('main').first().text()
  )
  const description =
    meta($, 'meta[property="og:description"]', 'meta[name="description"]') || content.slice(0, 500)
  const published = meta(
    $,
    'meta[property="article:published_time"]',
    'meta[name="date"]',
    'meta[itemprop="datePublished"]'
  )
  return {
    title: cleanArticleText(title),
    url: parsedUrl.toString(),
    publisher:
      meta($, 'meta[property="og:site_name"]', 'meta[name="application-name"]') || parsedUrl.hostname.replace(/^www\./, ''),
    author: meta($, 'meta[name="author"]', 'meta[property="article:author"]'),
    published_at: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null,
    excerpt: cleanArticleText(description).slice(0, 1000),
    content,
    content_status: inferContentStatus(content),
  }
}

function privateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '')
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:')) return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  const parts = normalized.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    parts[0] === 0
  )
}

async function assertPublicUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use uma URL pública HTTP/HTTPS sem credenciais.')
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local')) {
    throw new Error('Endereço local não é permitido.')
  }
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true })
  if (!addresses.length || addresses.some((item) => privateAddress(item.address))) {
    throw new Error('O link aponta para uma rede privada ou reservada.')
  }
}

function articlesFromText(value: string, label?: string): ManualArticle[] {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  const chunks = normalized
    .split(/\n\s*(?:-{3,}|={3,})\s*\n|\n{2,}/)
    .map((chunk) => cleanArticleText(chunk))
    .filter((chunk) => chunk.length >= 20)
  return (chunks.length ? chunks : [cleanArticleText(normalized)]).map((content, index) => {
    const lines = content.split(/(?<=[.!?])\s+/)
    const first = lines[0]?.replace(/^\[[^\]]+\]\s*/, '').trim() || ''
    const title =
      (index === 0 && label?.trim()) ||
      (first.length <= 220 ? first : `${first.slice(0, 217).trim()}…`) ||
      `Notícia recebida ${index + 1}`
    const url = content.match(/https?:\/\/[^\s<>()]+/i)?.[0]?.replace(/[.,;:]+$/, '') || null
    return {
      title,
      url,
      publisher: null,
      author: null,
      published_at: null,
      excerpt: content.slice(0, 1000),
      content,
      content_status: inferContentStatus(content),
    }
  })
}

async function saveArticle(
  supabase: ReturnType<typeof createClient>,
  item: ManualArticle,
  documentId: string,
  sourceId: string,
  acquisitionType: 'url' | 'text'
) {
  const fingerprint = await canonicalArticleFingerprint(item)
  let existing: Article | null = null
  if (item.url) {
    const { data } = await supabase.from('articles').select('*').eq('url', item.url).maybeSingle()
    existing = data as Article | null
  }
  if (!existing) {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('canonical_fingerprint', fingerprint)
      .limit(1)
      .maybeSingle()
    existing = data as Article | null
  }
  let article: Article
  if (existing) {
    const patch: Record<string, unknown> = {
      canonical_fingerprint: existing.canonical_fingerprint || fingerprint,
      url: existing.url || item.url,
      publisher: existing.publisher || item.publisher,
      author: existing.author || item.author,
      published_at: existing.published_at || item.published_at,
      excerpt: existing.excerpt || item.excerpt,
    }
    if (item.content.length > cleanArticleText(existing.content).length) {
      patch.content = item.content
      patch.content_status = item.content_status
    }
    const { data, error } = await supabase.from('articles').update(patch).eq('id', existing.id).select().single()
    if (error || !data) throw new Error(error?.message || 'Falha ao enriquecer a matéria.')
    article = data as Article
  } else {
    const { data, error } = await supabase
      .from('articles')
      .insert({
        source_id: sourceId,
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
    if (error || !data) throw new Error(error?.message || 'Falha ao salvar a matéria.')
    article = data as Article
  }
  const { data: provenance } = await supabase
    .from('article_provenance')
    .select('id')
    .eq('article_id', article.id)
    .eq('source_document_id', documentId)
    .maybeSingle()
  if (!provenance) {
    const { error: provenanceError } = await supabase.from('article_provenance').insert({
      article_id: article.id,
      source_document_id: documentId,
      source_id: sourceId,
      acquisition_type: acquisitionType,
      original_reference: item.url,
    })
    if (provenanceError) throw new Error(provenanceError.message)
  }
  return article
}

async function linkClients(
  supabase: ReturnType<typeof createClient>,
  batch: { period_month: string },
  clientIds: string[],
  documentId: string,
  articles: Article[]
) {
  if (articles.length) await classifyArticleBatch(supabase, articles)
  const now = new Date().toISOString()
  for (const clientId of clientIds) {
    for (const article of articles) {
      await supabase.from('article_period_assignments').upsert(
        {
          article_id: article.id,
          client_id: clientId,
          period_month: batch.period_month,
          source_document_id: documentId,
        },
        { onConflict: 'article_id,client_id,period_month,source_document_id' }
      )
      const tagResult = await supabase
        .from('article_client_tags')
        .select(
          'classification_source, report_role_source, central_message, impact_summary, recommended_action, strategic_effect, manual_received_at'
        )
        .eq('article_id', article.id)
        .eq('client_id', clientId)
        .maybeSingle()
      let tag = tagResult.data
      let supportsManualIntake = true
      if (missingManualIntakeColumn(tagResult.error?.message)) {
        supportsManualIntake = false
        const fallback = await supabase
          .from('article_client_tags')
          .select(
            'classification_source, report_role_source, central_message, impact_summary, recommended_action, strategic_effect'
          )
          .eq('article_id', article.id)
          .eq('client_id', clientId)
          .maybeSingle()
        if (fallback.error) throw new Error(fallback.error.message)
        tag = fallback.data ? { ...fallback.data, manual_received_at: null } : null
      } else if (tagResult.error) {
        throw new Error(tagResult.error.message)
      }
      if (tag && supportsManualIntake) {
        const { error: manualError } = await supabase
          .from('article_client_tags')
          .update({
            manual_intake: true,
            manual_received_at: tag.manual_received_at || now,
          })
          .eq('article_id', article.id)
          .eq('client_id', clientId)
        if (manualError) throw new Error(manualError.message)
      }
      if (tag?.classification_source === 'humano' || tag?.report_role_source === 'humano') continue
      if (tag) {
        await supabase
          .from('article_client_tags')
          .update({
            central_message: tag.central_message || article.excerpt || article.title,
            impact_summary: tag.impact_summary || 'Notícia adicionada manualmente e vinculada a este cliente.',
            strategic_effect: tag.strategic_effect || 'informativo',
            recommended_action: tag.recommended_action || 'Revisar o papel desta publicação no relatório.',
            verification_status: 'pendente',
            source_verification_status:
              article.content_status === 'parcial' ? 'parcial' : 'nao_verificada',
            editorial_review_state: 'pendente',
            qualified_at: now,
            qualification_version: 1,
          })
          .eq('article_id', article.id)
          .eq('client_id', clientId)
        continue
      }
      await supabase.from('article_client_tags').upsert(
        {
          article_id: article.id,
          client_id: clientId,
          tom: 'neutro',
          relevancia: 'media',
          cita_cliente: false,
          tema: 'Notícia recebida',
          classification_source: 'regra',
          confidence: 0,
          impact_summary: 'Notícia adicionada manualmente e vinculada a este cliente.',
          monitoring_status: 'revisao',
          report_role: 'contexto',
          editorial_score: 40,
          editorial_reason: 'Aguardando qualificação editorial para o relatório mensal.',
          report_role_source: 'regra',
          central_message: article.excerpt || article.title,
          strategic_effect: 'informativo',
          recommended_action: 'Revisar mensagem, impacto e papel desta publicação no relatório.',
          verification_status: 'pendente',
          source_verification_status:
            article.content_status === 'parcial' ? 'parcial' : 'nao_verificada',
          editorial_review_state: 'pendente',
          ...(supportsManualIntake ? { manual_intake: true, manual_received_at: now } : {}),
          qualified_at: now,
          qualification_version: 1,
        },
        { onConflict: 'article_id,client_id' }
      )
    }
  }
  const { data: drafts } = await supabase
    .from('monthly_report_drafts')
    .select('id')
    .in('client_id', clientIds)
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
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = importBatchItemsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const [{ data: batch }, { data: clientLinks }, { data: importSource }] = await Promise.all([
    supabase.from('import_batches').select('*').eq('id', id).single(),
    supabase.from('import_batch_clients').select('client_id').eq('batch_id', id),
    supabase.from('sources').select('id').eq('url', 'https://cortex.invalid/documentos-importados').single(),
  ])
  if (!batch) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 })
  if (batch.intent !== 'noticias') {
    return NextResponse.json({ error: 'URLs e mensagens só podem ser adicionadas como notícias.' }, { status: 400 })
  }
  if (!importSource) return NextResponse.json({ error: 'Aplique a migration 023.' }, { status: 409 })
  const clientIds = clientLinks?.length ? clientLinks.map((link) => link.client_id) : [batch.client_id]
  const results: Array<Record<string, unknown>> = []
  for (const [index, input] of parsed.data.items.entries()) {
    let failedDocumentId: string | null = null
    try {
      const raw = input.value.trim()
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${input.kind}\n${raw}`))
      const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      const filename =
        input.label?.trim() ||
        (input.kind === 'url' ? `link-${index + 1}.json` : `mensagem-${index + 1}.txt`)
      let { data: document } = await supabase
        .from('source_documents')
        .select('*')
        .eq('sha256', sha256)
        .maybeSingle()
      if (!document) {
        const documentId = crypto.randomUUID()
        const path = `manual/${batch.period_month.slice(0, 7)}/${documentId}-${filename.replace(/[^a-z0-9._-]+/gi, '-')}`
        const { error: uploadError } = await supabase.storage
          .from('source-documents')
          .upload(path, new Blob([raw], { type: input.kind === 'url' ? 'application/json' : 'text/plain' }))
        if (uploadError) throw new Error(uploadError.message)
        const { data: created, error: documentError } = await supabase
          .from('source_documents')
          .insert({
            id: documentId,
            filename,
            storage_path: path,
            sha256,
            document_type: input.kind === 'url' ? 'lista_urls' : 'mensagem',
            status: 'processando',
            metadata: { input_kind: input.kind },
          })
          .select()
          .single()
        if (documentError || !created) throw new Error(documentError?.message || 'Falha ao preservar a entrada.')
        document = created
      }
      failedDocumentId = document.id
      await supabase.from('import_batch_documents').upsert(
        {
          batch_id: id,
          document_id: document.id,
          filename,
          input_kind: input.kind,
          status: 'processing',
          error: null,
        },
        { onConflict: 'batch_id,document_id' }
      )
      const parsedArticles =
        input.kind === 'url' ? [await articleFromUrl(raw)] : articlesFromText(raw, input.label)
      const articles: Article[] = []
      for (const item of parsedArticles) {
        articles.push(await saveArticle(supabase, item, document.id, importSource.id, input.kind))
      }
      await linkClients(supabase, batch, clientIds, document.id, articles)
      await supabase
        .from('source_documents')
        .update({
          status: articles.length ? 'concluido' : 'revisao',
          imported_article_count: articles.length,
          processed_at: new Date().toISOString(),
        })
        .eq('id', document.id)
      await supabase
        .from('import_batch_documents')
        .update({
          status: articles.length ? 'complete' : 'review',
          article_count: articles.length,
          processed_at: new Date().toISOString(),
        })
        .eq('batch_id', id)
        .eq('document_id', document.id)
      results.push({ input: filename, status: 'complete', articles: articles.length })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar entrada.'
      if (failedDocumentId) {
        await Promise.all([
          supabase
            .from('source_documents')
            .update({ status: 'erro', error: message, processed_at: new Date().toISOString() })
            .eq('id', failedDocumentId),
          supabase
            .from('import_batch_documents')
            .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
            .eq('batch_id', id)
            .eq('document_id', failedDocumentId),
        ])
      }
      results.push({
        input: input.label || `${input.kind} ${index + 1}`,
        status: 'error',
        error: message,
      })
    }
  }
  const updated = await refreshImportBatch(supabase, id)
  return NextResponse.json({ batch: updated, results })
}
