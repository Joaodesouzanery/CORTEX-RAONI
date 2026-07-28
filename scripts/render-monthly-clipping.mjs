import React from 'react'
import { pathToFileURL } from 'node:url'
import { Document, Page, Text, View, Link, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '')
const SECRET = process.env.CRON_SECRET || ''
const EDITION_ID = process.env.EDITION_ID || process.argv[2] || ''

const headers = {
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
}

async function api(path, init = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers || {}) },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || `${path}: HTTP ${res.status}`)
  return data
}

const styles = StyleSheet.create({
  cover: { fontFamily: 'Helvetica', padding: 58, position: 'relative' },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 16, backgroundColor: '#111111' },
  brand: { fontSize: 12, letterSpacing: 3, fontFamily: 'Helvetica-Bold' },
  coverTitle: { marginTop: 150, fontSize: 31, lineHeight: 1.12, fontFamily: 'Times-Bold' },
  rule: { marginVertical: 20, width: 65, height: 3, backgroundColor: '#111111' },
  client: { fontSize: 19, fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  muted: { fontSize: 10, color: '#6b7280', marginBottom: 3 },
  confidential: {
    marginTop: 24,
    fontSize: 9,
    letterSpacing: 2,
    border: '1 solid #111111',
    padding: 6,
    alignSelf: 'flex-start',
  },
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    lineHeight: 1.45,
    paddingTop: 45,
    paddingBottom: 50,
    paddingHorizontal: 50,
    color: '#20242b',
  },
  h1: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 12 },
  h2: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginTop: 13,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottom: '1 solid #dddddd',
  },
  p: { marginBottom: 7, textAlign: 'justify' },
  metricRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  metric: { flexGrow: 1, border: '1 solid #dddddd', padding: 8 },
  metricValue: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  metricLabel: { fontSize: 7.5, textTransform: 'uppercase', color: '#6b7280' },
  tocRow: { flexDirection: 'row', borderBottom: '0.5 solid #eeeeee', paddingVertical: 3 },
  tocNum: { width: 22, fontFamily: 'Helvetica-Bold' },
  tocTitle: { flex: 1, paddingRight: 8 },
  tocPage: { width: 30, textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  articleTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 6 },
  meta: { fontSize: 8.5, color: '#555555', marginBottom: 3 },
  badge: { fontSize: 7.5, border: '1 solid #999999', padding: 3, alignSelf: 'flex-start', marginVertical: 5 },
  url: { fontSize: 7.5, color: '#1d4ed8', marginBottom: 9 },
  separator: { height: 1, backgroundColor: '#dddddd', marginVertical: 8 },
})

const h = React.createElement

function periodLabel(period) {
  const [year, month] = String(period).slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 15))
  )
}

function summaryNodes(markdown) {
  return String(markdown || 'Síntese automatizada indisponível; o caderno completo segue abaixo.')
    .split(/\n{2,}/)
    .map((block, i) => {
      const line = block.trim()
      if (!line || line.startsWith('# ')) return null
      if (line.startsWith('## ')) return h(Text, { key: i, style: styles.h2 }, line.slice(3))
      return h(Text, { key: i, style: styles.p }, line.replace(/\*\*/g, ''))
    })
    .filter(Boolean)
}

function distribution(items, selector, fallback = 'não identificado') {
  const counts = new Map()
  for (const item of items) {
    const value = selector(item) || fallback
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
}

function distributionText(rows, limit = rows.length) {
  return rows
    .slice(0, limit)
    .map(([label, value]) => `${label}: ${value}`)
    .join(' · ')
}

function FrontDocument({ edition, items, starts }) {
  const client = Array.isArray(edition.clients) ? edition.clients[0] : edition.clients
  const counts = edition.counts || {}
  const metrics = [
    [counts.total || 0, 'publicações'],
    [counts.mencoes_diretas || 0, 'menções diretas'],
    [counts.cobertura_setorial || 0, 'cobertura setorial'],
    [counts.integral || 0, 'com íntegra'],
  ]
  const tones = distribution(items, (item) => {
    const tone = item.classification_snapshot?.tom
    return tone === 'neutro' || !tone ? 'técnica' : tone === 'critico' ? 'crítica' : tone
  })
  const relevance = distribution(items, (item) => item.classification_snapshot?.relevancia)
  const sourceTypes = distribution(items, (item) => item.article_snapshot?.source_categoria)
  const outlets = distribution(items, (item) => item.article_snapshot?.publisher || item.article_snapshot?.source_name)
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.cover },
      h(View, { style: styles.band }),
      h(Text, { style: styles.brand }, 'CORTEX'),
      h(Text, { style: styles.coverTitle }, 'Clipping Mensal de Notícias'),
      h(View, { style: styles.rule }),
      h(Text, { style: styles.client }, client?.name || 'Cliente'),
      h(Text, { style: styles.muted }, periodLabel(edition.period_month)),
      h(Text, { style: styles.muted }, `Versão ${edition.version} · ${counts.total || 0} publicações`),
      h(Text, { style: styles.confidential }, 'CONFIDENCIAL')
    ),
    h(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      h(Text, { style: styles.h1 }, 'Panorama e síntese do mês'),
      h(
        View,
        { style: styles.metricRow },
        ...metrics.map(([value, label]) =>
          h(
            View,
            { key: label, style: styles.metric },
            h(Text, { style: styles.metricValue }, String(value)),
            h(Text, { style: styles.metricLabel }, label)
          )
        )
      ),
      h(Text, { style: styles.h2 }, 'Cobertura e metodologia'),
      h(
        Text,
        { style: styles.p },
        `Este caderno preserva todas as publicações relacionadas ao cliente no mês. ${counts.integral || 0} item(ns) possuem texto integral, ${counts.parcial || 0} conteúdo parcial e ${counts.metadados || 0} apenas metadados. Publicações de veículos diferentes sobre a mesma pauta permanecem individualizadas.`
      ),
      ...summaryNodes(edition.summary_markdown),
      h(Text, { style: styles.h2 }, 'Panorama quantitativo'),
      h(Text, { style: styles.p }, `Tom: ${distributionText(tones) || 'sem ocorrências'}.`),
      h(Text, { style: styles.p }, `Relevância: ${distributionText(relevance) || 'sem ocorrências'}.`),
      h(Text, { style: styles.p }, `Tipo de fonte: ${distributionText(sourceTypes) || 'sem ocorrências'}.`),
      h(Text, { style: styles.p }, `Veículos: ${distributionText(outlets, 12) || 'sem ocorrências'}.`),
      h(Text, { style: styles.h1, break: true }, 'Sumário'),
      ...items.map((item, index) => {
        const article = item.article_snapshot
        const publisher = article.publisher || article.source_name || 'Veículo não identificado'
        return h(
          View,
          { key: item.id, style: styles.tocRow, wrap: false },
          h(Text, { style: styles.tocNum }, `${index + 1}.`),
          h(Text, { style: styles.tocTitle }, `${article.title} — ${publisher}`),
          h(Text, { style: styles.tocPage }, String(starts[index] || '—'))
        )
      })
    )
  )
}

function articleParagraphs(item) {
  const article = item.article_snapshot
  const raw = article.content || article.excerpt || '(texto integral indisponível; consulte a referência original)'
  return String(raw)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

function ArticleDocument({ item, index }) {
  const article = item.article_snapshot
  const cls = item.classification_snapshot || {}
  const publisher = article.publisher || article.source_name || 'Veículo não identificado'
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : 'Data não identificada'
  const section =
    item.section === 'mencao_direta'
      ? 'MENÇÃO DIRETA'
      : item.section === 'baixa_confianca'
        ? 'OUTRA OCORRÊNCIA MONITORADA'
        : 'COBERTURA SETORIAL'
  const tone =
    cls.tom === 'positivo'
      ? 'positiva'
      : cls.tom === 'negativo'
        ? 'negativa'
        : cls.tom === 'critico'
          ? 'crítica'
          : 'técnica'
  return h(
    Document,
    null,
    h(
      Page,
      { size: 'A4', style: styles.page, wrap: true },
      h(Text, { style: styles.meta }, `${section} · ITEM ${index + 1}`),
      h(Text, { style: styles.articleTitle }, article.title),
      h(Text, { style: styles.meta }, `${publisher} · ${date}${article.author ? ` · ${article.author}` : ''}`),
      h(
        Text,
        { style: styles.badge },
        `${tone.toUpperCase()} · ${(cls.relevancia || 'não classificada').toUpperCase()} · ${article.content_status.toUpperCase()}`
      ),
      cls.impact_summary ? h(Text, { style: styles.p }, cls.impact_summary) : null,
      article.url ? h(Link, { src: article.url, style: styles.url }, article.url) : null,
      h(View, { style: styles.separator }),
      ...articleParagraphs(item).map((p, i) => h(Text, { key: i, style: styles.p }, p))
    )
  )
}

async function pageCount(buffer) {
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}

async function mapLimit(values, limit, fn) {
  const result = new Array(values.length)
  let cursor = 0
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++
      result[index] = await fn(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return result
}

const sourcePdfCache = new Map()

async function sourcePdf(documentId) {
  if (!sourcePdfCache.has(documentId)) {
    sourcePdfCache.set(
      documentId,
      (async () => {
        const signed = await api(`/api/internal/source-documents/${documentId}/download`)
        const response = await fetch(signed.url)
        if (!response.ok) throw new Error(`Documento-fonte ${documentId}: HTTP ${response.status}`)
        return new Uint8Array(await response.arrayBuffer())
      })()
    )
  }
  return sourcePdfCache.get(documentId)
}

async function appendOriginalPdfPages(headerBuffer, origin) {
  if (!origin?.document_id || !origin.page_start || !origin.page_end) return headerBuffer
  const bytes = await sourcePdf(origin.document_id)
  const source = await PDFDocument.load(bytes)
  const first = Math.max(0, origin.page_start - 1)
  const last = Math.min(source.getPageCount() - 1, origin.page_end - 1)
  if (last < first) return headerBuffer

  const output = await PDFDocument.create()
  const header = await PDFDocument.load(headerBuffer)
  const headerPages = await output.copyPages(header, header.getPageIndices())
  headerPages.forEach((page) => output.addPage(page))
  const pageIndexes = Array.from({ length: last - first + 1 }, (_, index) => first + index)
  const originalPages = await output.copyPages(source, pageIndexes)
  originalPages.forEach((page) => output.addPage(page))
  return output.save()
}

export async function renderEdition(edition) {
  const sectionOrder = { mencao_direta: 0, cobertura_setorial: 1, baixa_confianca: 2 }
  const items = [...(edition.items || [])].sort((a, b) => {
    const section = (sectionOrder[a.section] ?? 9) - (sectionOrder[b.section] ?? 9)
    if (section) return section
    const firstDate = a.article_snapshot?.published_at ? new Date(a.article_snapshot.published_at).getTime() : 0
    const secondDate = b.article_snapshot?.published_at ? new Date(b.article_snapshot.published_at).getTime() : 0
    return secondDate - firstDate
  })
  const articleBuffers = await mapLimit(items, 4, async (item, index) => {
    const rendered = await renderToBuffer(h(ArticleDocument, { item, index }))
    if (item.article_snapshot?.content_status === 'integral') return rendered
    return appendOriginalPdfPages(rendered, item.article_snapshot?.origin_pdf)
  })
  const articlePages = await Promise.all(articleBuffers.map(pageCount))

  let starts = items.map(() => 0)
  let frontBuffer = await renderToBuffer(h(FrontDocument, { edition, items, starts }))
  let frontPages = await pageCount(frontBuffer)
  starts = articlePages.map((_, index) => frontPages + 1 + articlePages.slice(0, index).reduce((sum, n) => sum + n, 0))
  frontBuffer = await renderToBuffer(h(FrontDocument, { edition, items, starts }))
  const finalFrontPages = await pageCount(frontBuffer)
  if (finalFrontPages !== frontPages) {
    frontPages = finalFrontPages
    starts = articlePages.map(
      (_, index) => frontPages + 1 + articlePages.slice(0, index).reduce((sum, n) => sum + n, 0)
    )
    frontBuffer = await renderToBuffer(h(FrontDocument, { edition, items, starts }))
  }

  const merged = await PDFDocument.create()
  for (const buffer of [frontBuffer, ...articleBuffers]) {
    const source = await PDFDocument.load(buffer)
    const copied = await merged.copyPages(source, source.getPageIndices())
    copied.forEach((page) => merged.addPage(page))
  }
  const font = await merged.embedFont(StandardFonts.Helvetica)
  const client = Array.isArray(edition.clients) ? edition.clients[0] : edition.clients
  const pages = merged.getPages()
  pages.forEach((page, index) => {
    const { width } = page.getSize()
    const text = `${client?.name || 'CORTEX'} · CONFIDENCIAL · ${index + 1}/${pages.length}`
    page.drawText(text, {
      x: 50,
      y: 23,
      size: 7.5,
      font,
      color: rgb(0.4, 0.4, 0.4),
      maxWidth: width - 100,
    })
  })
  return merged.save()
}

async function main() {
  if (!APP_URL || !SECRET || !EDITION_ID) {
    throw new Error('APP_URL, CRON_SECRET e EDITION_ID são obrigatórios.')
  }
  try {
    let offset = 0
    while (true) {
      const result = await api(`/api/internal/monthly-editions/${EDITION_ID}/classify`, {
        method: 'POST',
        body: JSON.stringify({ offset }),
      })
      if (result.done) break
      offset = result.nextOffset
    }
    let payloadOffset = 0
    let edition = null
    const items = []
    while (true) {
      const page = await api(`/api/internal/monthly-editions/${EDITION_ID}/payload?offset=${payloadOffset}&limit=50`)
      edition ||= page
      items.push(...(page.items || []))
      if (page.page?.done) break
      payloadOffset = page.page?.nextOffset
    }
    edition = { ...edition, items }
    const pdf = await renderEdition(edition)
    const upload = await api(`/api/internal/monthly-editions/${EDITION_ID}/upload-url`, { method: 'POST' })
    const uploadRes = await fetch(upload.signedUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' },
      body: pdf,
    })
    if (!uploadRes.ok) throw new Error(`Upload do PDF falhou: HTTP ${uploadRes.status} ${await uploadRes.text()}`)
    await api(`/api/internal/monthly-editions/${EDITION_ID}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        pdf_storage_path: upload.path,
        summary_markdown: edition.summary_markdown,
        summary_data: edition.summary_data || {},
      }),
    })
    process.stdout.write(`Edição ${EDITION_ID}: ${edition.items?.length || 0} itens, ${pdf.length} bytes.\n`)
  } catch (error) {
    await api(`/api/internal/monthly-editions/${EDITION_ID}/fail`, {
      method: 'POST',
      body: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
    }).catch(() => {})
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
