import { cleanArticleText, inferContentStatus } from '@/lib/archive'
import { normalizeText } from '@/lib/relevance'
import type { ContentStatus, ImportDocumentType } from '@/types'

export interface ParsedPdfArticle {
  title: string
  publisher: string | null
  author: string | null
  published_at: string | null
  url: string | null
  excerpt: string | null
  content: string
  content_status: ContentStatus
  page_start: number
  page_end: number
}

export interface ParsedPdfDocument {
  documentType: ImportDocumentType
  pageCount: number
  metadata: Record<string, unknown>
  referenceText?: string
  articles: ParsedPdfArticle[]
  warnings: string[]
}

interface PageInput {
  num: number
  text: string
  links?: Array<{ text: string; url: string }>
}

interface Footer {
  title: string
  date: string
  publisher: string
  index: number
}

interface TocEntry {
  title: string
  publisher: string
  page: number
}

const FOOTER_RE =
  /(?:^|\n)([^\n]{3,320})\n(\d{1,2}\/\d{1,2}\/\d{4})\s*\|\s*([^|\n]+?)\s*\|\s*Clique aqui para visualizar a notícia no navegador/i

function isoFromUsDate(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim())
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day, 12)).toISOString()
}

function footerOf(text: string): Footer | null {
  const match = FOOTER_RE.exec(text.replace(/\u00a0/g, ' '))
  if (!match) return null
  return {
    title: match[1].trim(),
    date: match[2],
    publisher: match[3].trim(),
    index: match.index,
  }
}

function authorOf(text: string): string | null {
  const explicit = text.match(/(?:^|\n)Autor:\s*([^\n]+)/i)?.[1]?.trim()
  if (explicit) return explicit
  const byline = text.match(/(?:^|\n)Por\s+([^\n]{3,120})(?:\n|$)/i)?.[1]?.trim()
  return byline || null
}

function firstArticleUrl(page: PageInput): string | null {
  const links = page.links || []
  const preferred = links.find(
    (l) =>
      /^https?:\/\//i.test(l.url) && !/(\.mp4|\.m3u8|youtube\.com|youtu\.be|facebook\.com|instagram\.com)/i.test(l.url)
  )
  return preferred?.url || null
}

function cleanVendorPage(text: string, footer: Footer): string {
  let body = text.slice(0, footer.index)
  body = body
    .replace(/^\s*Continuação\s*(?:\n|$)/i, '')
    .replace(/\nEsta notícia contém conteúdo em vídeo\.[\s\S]*$/i, '')
    .replace(/\nPUBLICIDADE(?:\n|$)/gi, '\n')
    .replace(/\nPublicidade(?:\n|$)/gi, '\n')
    .replace(/\nGerando resumo(?:\n|$)/gi, '\n')
    .trim()
  return cleanArticleText(body)
}

function tocEntries(pages: PageInput[]): { page: number; entries: TocEntry[] } | null {
  const tocPage = pages.find((page) => /(?:^|\n)\s*Sumário\s*(?:\n|$)/i.test(page.text))
  if (!tocPage) return null
  const lines = tocPage.text
    .slice(tocPage.text.search(/(?:^|\n)\s*Sumário\s*(?:\n|$)/i))
    .split('\n')
    .slice(1)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const entries: TocEntry[] = []
  let pending = ''
  for (const line of lines) {
    pending = `${pending} ${line}`.trim()
    const pageMatch = pending.match(/\s(\d{1,4})$/)
    if (!pageMatch || !pending.includes(' - ')) continue
    const beforePage = pending.slice(0, pageMatch.index).trim()
    const separator = beforePage.lastIndexOf(' - ')
    const title = beforePage.slice(0, separator).trim()
    const publisher = beforePage.slice(separator + 3).trim()
    const page = Number(pageMatch[1])
    if (title.length >= 5 && publisher && page >= 1) {
      entries.push({ title, publisher, page })
    }
    pending = ''
  }
  return entries.length >= 2 ? { page: tocPage.num, entries } : null
}

function articleStartOffset(pages: PageInput[], toc: { page: number; entries: TocEntry[] }): number {
  const first = toc.entries[0]
  const title = normalizeText(first.title)
  const match = pages.find((page) => page.num > toc.page && normalizeText(page.text).includes(title))
  return match ? match.num - first.page : toc.page
}

/**
 * Preferred vendor parser. The TOC page numbers define exact article ranges;
 * the footer supplies date/URL metadata and may occur only on the last page.
 */
export function parseVendorClippingToc(pages: PageInput[]): {
  articles: ParsedPdfArticle[]
  tocCount: number
} {
  const toc = tocEntries(pages)
  if (!toc) return { articles: [], tocCount: 0 }
  const offset = articleStartOffset(pages, toc)
  const byNumber = new Map(pages.map((page) => [page.num, page]))

  const articles = toc.entries.map((entry, index) => {
    const start = entry.page + offset
    const next = toc.entries[index + 1]
    const end = Math.min(pages.length, next ? next.page + offset - 1 : pages[pages.length - 1]?.num || start)
    const range = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => byNumber.get(start + i)).filter(
      (page): page is PageInput => Boolean(page)
    )
    const footer = [...range]
      .reverse()
      .map((page) => footerOf(page.text))
      .find((value): value is Footer => Boolean(value))
    let content = cleanArticleText(
      range
        .map((page) => {
          const pageFooter = footerOf(page.text)
          if (pageFooter) return cleanVendorPage(page.text, pageFooter)
          return cleanArticleText(
            page.text.replace(/^\s*Continuação\s*(?:\n|$)/i, '').replace(/\nPUBLICIDADE(?:\n|$)/gi, '\n')
          )
        })
        .filter(Boolean)
        .join('\n\n')
    )
    if (normalizeText(content).startsWith(normalizeText(entry.title))) {
      content = content.replace(new RegExp(`^${escapeRegExp(entry.title)}\\s*`, 'i'), '').trim()
    }
    const author = authorOf(content)
    content = content.replace(/(?:^|\n)Autor:\s*[^\n]+/i, '\n').trim()
    return {
      title: entry.title,
      publisher: footer?.publisher || entry.publisher,
      author,
      published_at: footer ? isoFromUsDate(footer.date) : null,
      url: range.map(firstArticleUrl).find(Boolean) || null,
      excerpt: content.slice(0, 500) || null,
      content,
      content_status: inferContentStatus(content),
      page_start: start,
      page_end: end,
    }
  })

  return { articles, tocCount: toc.entries.length }
}

/** Parser test seam: converts already-extracted pages from a vendor clipping. */
export function parseVendorClippingPages(pages: PageInput[]): ParsedPdfArticle[] {
  const groups: Array<{
    footer: Footer
    start: number
    end: number
    texts: string[]
    url: string | null
  }> = []

  for (const page of pages) {
    const footer = footerOf(page.text)
    if (!footer) continue
    const key = normalizeText(`${footer.title}|${footer.publisher}|${footer.date}`)
    const previous = groups[groups.length - 1]
    const previousKey = previous
      ? normalizeText(`${previous.footer.title}|${previous.footer.publisher}|${previous.footer.date}`)
      : ''
    if (previous && previousKey === key && page.num === previous.end + 1) {
      previous.end = page.num
      previous.texts.push(cleanVendorPage(page.text, footer))
      previous.url ||= firstArticleUrl(page)
    } else {
      groups.push({
        footer,
        start: page.num,
        end: page.num,
        texts: [cleanVendorPage(page.text, footer)],
        url: firstArticleUrl(page),
      })
    }
  }

  return groups.map((g) => {
    let content = cleanArticleText(g.texts.filter(Boolean).join('\n\n'))
    const normalizedTitle = normalizeText(g.footer.title)
    if (normalizeText(content).startsWith(normalizedTitle)) {
      content = content.replace(new RegExp(`^${escapeRegExp(g.footer.title)}\\s*`, 'i'), '').trim()
    }
    const author = authorOf(content)
    content = content.replace(/(?:^|\n)Autor:\s*[^\n]+/i, '\n').trim()
    return {
      title: g.footer.title,
      publisher: g.footer.publisher,
      author,
      published_at: isoFromUsDate(g.footer.date),
      url: g.url,
      excerpt: content.slice(0, 500) || null,
      content,
      content_status: inferContentStatus(content),
      page_start: g.start,
      page_end: g.end,
    }
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decodeReaderUrl(text: string): string | null {
  const match = text.match(/about:reader\?url=([^\s|]+)/i)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

function cleanPrintedArticle(text: string): string {
  return cleanArticleText(
    text
      .replace(/about:reader\?url=[^\s|]+/gi, ' ')
      .replace(/\b\d+\s+de\s+\d+\b\d{2}\/\d{2}\/\d{4},?\s*\d{2}:\d{2}/gi, ' ')
      .replace(/Conheça o Valor One[\s\S]*?Acompanhe os mercados com nossas ferramentas/gi, ' ')
      .replace(/Mais recente\s*Próxima[\s\S]*?(?=\n|$)/gi, ' ')
      .replace(/valor\.globo\.com/gi, ' ')
  )
}

function titleFromMetadata(raw: unknown, filename: string, text: string): string {
  const meta = typeof raw === 'string' ? raw : ''
  const fromMeta = meta.split(/\s+\|\s+/)[0]?.trim()
  if (fromMeta) return fromMeta
  const base = filename.replace(/\.pdf$/i, '').trim()
  if (base) return base
  return (
    text
      .split('\n')
      .map((x) => x.trim())
      .find((x) => x.length >= 8) || '(sem título)'
  )
}

function publisherFromMetadata(raw: unknown, text: string): string | null {
  const meta = typeof raw === 'string' ? raw : ''
  if (/Valor Econômico/i.test(meta) || /valor\.globo\.com/i.test(text)) return 'Valor Econômico'
  const parts = meta
    .split(/\s+\|\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
  return parts.length >= 2 ? parts[parts.length - 1] : null
}

function creationDate(info: Record<string, unknown> | undefined): string | null {
  const raw = info?.CreationDate
  if (typeof raw !== 'string') return null
  const m = /^D:(\d{4})(\d{2})(\d{2})/.exec(raw)
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12)).toISOString() : null
}

export function looksLikeReferenceReport(text: string): boolean {
  const normalized = normalizeText(text)
  const signals = [
    /\brelatorio mensal\b/.test(normalized),
    /\bsumario executivo\b/.test(normalized),
    /\btemas estrategicos do mes\b/.test(normalized),
    /\bleitura reputacional\b/.test(normalized),
    /\briscos reputacionais\b/.test(normalized),
    /\brecomendacoes executivas\b/.test(normalized),
    /\bbase qualificada de evidencias\b/.test(normalized),
    /\bdemonstracao dos servicos\b/.test(normalized),
  ].filter(Boolean).length
  return signals >= 2
}

function looksLikeRasterizedReport(text: string, pageCount: number): boolean {
  if (pageCount < 5) return false
  const normalized = normalizeText(text)
  const sparse = normalized.length < pageCount * 120
  const pageMarkers = /--\s*1\s+of\s+\d+\s*--/i.test(text)
  const editorialMarker = /\b(confidencial|a\s+preencher|relatorio)\b/i.test(text)
  return sparse && pageMarkers && editorialMarker
}

function looksLikeDeliveredReportFilename(filename: string, pageCount: number) {
  if (pageCount < 5) return false
  const normalized = normalizeText(filename.replace(/\.pdf$/i, ''))
  return /\brelatorio\b/.test(normalized) &&
    /\b(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|20\d{2})\b/.test(normalized)
}

export async function parsePdf(data: Uint8Array, filename: string): Promise<ParsedPdfDocument> {
  // Load the Node canvas shim before pdf-parse. Besides supplying DOMMatrix in
  // serverless runtimes, the dynamic import keeps initialization failures
  // inside the API handler so the original document remains recoverable.
  const { CanvasFactory } = await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data, CanvasFactory })
  try {
    const info = await parser.getInfo({ parsePageInfo: true })
    const textResult = await parser.getText()
    const pages: PageInput[] = textResult.pages.map((p) => ({
      num: p.num,
      text: p.text || '',
      links: info.pages.find((x) => x.pageNumber === p.num)?.links || [],
    }))
    const tocResult = parseVendorClippingToc(pages)
    const vendorArticles = tocResult.articles.length > 0 ? tocResult.articles : parseVendorClippingPages(pages)
    const metadata = {
      title: info.info?.Title || null,
      author: info.info?.Author || null,
      producer: info.info?.Producer || null,
      toc_entries: tocResult.tocCount,
    }

    if (looksLikeDeliveredReportFilename(filename, textResult.total)) {
      return {
        documentType: 'relatorio',
        pageCount: textResult.total,
        metadata,
        referenceText: cleanArticleText(textResult.text),
        articles: [],
        warnings: ['Relatório final reconhecido pelo nome e pela paginação; nenhuma notícia foi criada.'],
      }
    }

    if (looksLikeRasterizedReport(textResult.text, textResult.total)) {
      return {
        documentType: 'relatorio',
        pageCount: textResult.total,
        metadata,
        articles: [],
        warnings: ['Relatório rasterizado reconhecido. Solicite OCR para tornar o conteúdo pesquisável.'],
      }
    }

    if (looksLikeReferenceReport(textResult.text)) {
      return {
        documentType: 'relatorio',
        pageCount: textResult.total,
        metadata,
        referenceText: cleanArticleText(textResult.text),
        articles: [],
        warnings: ['Relatório reconhecido e preservado como referência; nenhuma notícia foi criada.'],
      }
    }

    if (vendorArticles.length >= 2 || /\nSumário\s*\n/i.test(textResult.text)) {
      const withoutSearchableText = vendorArticles.filter((article) => article.content_status === 'metadados').length
      return {
        documentType: 'caderno',
        pageCount: textResult.total,
        metadata,
        articles: vendorArticles,
        warnings: vendorArticles.length
          ? withoutSearchableText
            ? [
                `${withoutSearchableText} matéria(s) possuem páginas sem texto pesquisável; o documento e a paginação foram preservados para conferência.`,
              ]
            : []
          : ['Sumário reconhecido, mas nenhuma matéria pôde ser separada.'],
      }
    }

    const cleaned = cleanPrintedArticle(textResult.text)
    if (cleaned.length >= 100) {
      const title = titleFromMetadata(info.info?.Title, filename, cleaned)
      const author = authorOf(cleaned) || (typeof info.info?.Author === 'string' ? info.info.Author : null)
      const pageUrl =
        pages.flatMap((p) => p.links || []).find((l) => /^https?:\/\//i.test(l.url))?.url ||
        decodeReaderUrl(textResult.text)
      const content = cleaned
        .replace(new RegExp(`^${escapeRegExp(title)}\\s*`, 'i'), '')
        .replace(/(?:^|\n)Por\s+[^\n]{3,120}(?:\n|$)/i, '\n')
        .trim()
      return {
        documentType: 'artigo',
        pageCount: textResult.total,
        metadata,
        articles: [
          {
            title,
            publisher: publisherFromMetadata(info.info?.Title, textResult.text),
            author,
            published_at: creationDate(info.info),
            url: pageUrl,
            excerpt: content.slice(0, 500) || null,
            content,
            content_status: inferContentStatus(content),
            page_start: 1,
            page_end: textResult.total,
          },
        ],
        warnings: [],
      }
    }

    return {
      documentType: 'desconhecido',
      pageCount: textResult.total,
      metadata,
      articles: [],
      warnings: ['O PDF não contém texto pesquisável suficiente.'],
    }
  } finally {
    await parser.destroy()
  }
}
