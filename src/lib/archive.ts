import type { Article, ArticleSnapshot, ArticleTag, ContentStatus, EditionSection, SourceCategoria } from '@/types'
import { normalizeText } from '@/lib/relevance'

export async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sha256Bytes(value: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value)
  const copy = Uint8Array.from(bytes)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function dayKey(date: string | null | undefined): string {
  if (!date) return 'sem-data'
  const parsed = new Date(date)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString().slice(0, 10) : normalizeText(date)
}

/** Stable identity for the same publication, independent of feed/PDF origin. */
export async function canonicalArticleFingerprint(input: {
  title: string
  publisher?: string | null
  published_at?: string | null
}): Promise<string> {
  return sha256Text(
    [normalizeText(input.publisher || 'desconhecido'), normalizeText(input.title), dayKey(input.published_at)].join('|')
  )
}

function significantWords(value: string | null | undefined): Set<string> {
  return new Set(
    normalizeText(cleanArticleText(value, 12000))
      .split(' ')
      .filter((token) => token.length >= 4)
  )
}

/**
 * Conservative fallback for two imported copies whose PDF metadata disagrees
 * about the vehicle. It is deliberately stricter than story clustering:
 * identical headline/day plus near-identical body text is required.
 */
export function sameImportedPublication(
  first:
    | Pick<Article, 'title' | 'published_at' | 'content'>
    | {
        title: string
        published_at?: string | null
        content?: string | null
      },
  second:
    | Pick<Article, 'title' | 'published_at' | 'content'>
    | {
        title: string
        published_at?: string | null
        content?: string | null
      }
): boolean {
  if (normalizeText(first.title) !== normalizeText(second.title)) return false
  if (dayKey(first.published_at) !== dayKey(second.published_at)) return false
  if (dayKey(first.published_at) === 'sem-data') return false

  const a = significantWords(first.content)
  const b = significantWords(second.content)
  if (a.size < 30 || b.size < 30) return false
  let intersection = 0
  a.forEach((word) => {
    if (b.has(word)) intersection++
  })
  const containment = intersection / Math.min(a.size, b.size)
  const union = a.size + b.size - intersection
  return intersection >= 25 && containment >= 0.35 && intersection / union >= 0.08
}

/** Coarse story grouping. Publications remain distinct; only the synthesis groups them. */
export function clusterKey(title: string, publishedAt?: string | null): string {
  const stop = new Set([
    'a',
    'as',
    'o',
    'os',
    'de',
    'da',
    'das',
    'do',
    'dos',
    'e',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'para',
    'por',
    'com',
    'que',
    'um',
    'uma',
    'ao',
    'aos',
  ])
  const tokens = normalizeText(title)
    .split(' ')
    .filter((t) => t.length >= 3 && !stop.has(t))
    .slice(0, 8)
    .sort()
  return `${dayKey(publishedAt)}:${tokens.join('-') || normalizeText(title).slice(0, 60)}`
}

export function cleanArticleText(raw: string | null | undefined, maxChars = 30000): string {
  if (!raw) return ''
  const text = raw
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text
}

export function inferContentStatus(content: string | null | undefined, excerpt?: string | null): ContentStatus {
  const length = cleanArticleText(content).length
  if (length >= 600) return 'integral'
  if (length > 0 || (excerpt?.trim().length || 0) > 0) return 'parcial'
  return 'metadados'
}

function saoPauloMidnight(year: number, month: number): string {
  const desiredWallClock = Date.UTC(year, month - 1, 1, 0, 0, 0)
  const probe = new Date(desiredWallClock)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(probe)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  const wallClockAtProbe = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second')
  )
  const offset = wallClockAtProbe - probe.getTime()
  return new Date(desiredWallClock - offset).toISOString()
}

export function monthBounds(period: string): { month: string; start: string; end: string } {
  const match = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(period)
  if (!match) throw new Error('Período inválido; use YYYY-MM.')
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) throw new Error('Mês inválido.')
  const start = saoPauloMidnight(year, month)
  const end = saoPauloMidnight(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1)
  return { month: `${match[1]}-${match[2]}-01`, start, end }
}

export function snapshotArticle(article: Article): ArticleSnapshot {
  const content = cleanArticleText(article.content)
  const categoria: SourceCategoria = article.sources?.categoria || 'imprensa'
  return {
    id: article.id,
    title: article.title,
    url: article.url || null,
    image_url: article.image_url || null,
    excerpt: article.excerpt || null,
    content: content || null,
    content_status: article.content_status || inferContentStatus(content, article.excerpt),
    author: article.author || null,
    published_at: article.published_at || null,
    publisher: article.publisher || null,
    source_name: article.sources?.name || null,
    source_categoria: categoria,
  }
}

export function editionSection(tag: ArticleTag | null | undefined): EditionSection {
  if ((tag?.confidence ?? 1) < 0.45 || tag?.relevancia === 'baixa') return 'baixa_confianca'
  return tag?.cita_cliente ? 'mencao_direta' : 'cobertura_setorial'
}

export const tomLabel = (tom: ArticleTag['tom'] | null | undefined): string => {
  if (tom === 'positivo') return 'positiva'
  if (tom === 'negativo') return 'negativa'
  if (tom === 'critico') return 'crítica'
  return 'técnica'
}
