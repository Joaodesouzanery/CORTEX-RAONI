import * as cheerio from 'cheerio'
import { cleanArticleText } from '@/lib/archive'
import { normalizeText } from '@/lib/relevance'
import type { Relevancia, Tom } from '@/types'

export interface ParsedReferenceEvidence {
  row_number: number
  title: string
  publisher: string | null
  author: string | null
  published_at: string | null
  relevance: Relevancia | null
  tone: Tom | null
}

export interface ParsedHtmlReport {
  title: string
  extractedText: string
  evidence: ParsedReferenceEvidence[]
  metadata: Record<string, unknown>
}

type CheerioRoot = ReturnType<typeof cheerio.load>

function cellText($: CheerioRoot, cell: cheerio.Element | undefined) {
  return cell ? cleanArticleText($(cell).text()) : ''
}

function findColumn(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)))
}

function parseDate(value: string, defaultYear: number): string | null {
  const normalized = value.trim()
  const numeric = normalized.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/)
  if (numeric) {
    const year = numeric[3]
      ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3])
      : defaultYear
    const date = new Date(Date.UTC(year, Number(numeric[2]) - 1, Number(numeric[1]), 12))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const months: Record<string, number> = {
    janeiro: 0,
    fevereiro: 1,
    marco: 2,
    abril: 3,
    maio: 4,
    junho: 5,
    julho: 6,
    agosto: 7,
    setembro: 8,
    outubro: 9,
    novembro: 10,
    dezembro: 11,
  }
  const words = normalizeText(normalized).match(/(\d{1,2}) de ([a-z]+)(?: de (\d{4}))?/)
  if (words && words[2] in months) {
    return new Date(Date.UTC(Number(words[3] || defaultYear), months[words[2]], Number(words[1]), 12)).toISOString()
  }
  return null
}

function relevance(value: string): Relevancia | null {
  const text = normalizeText(value)
  if (text.includes('alta')) return 'alta'
  if (text.includes('media')) return 'media'
  if (text.includes('baixa')) return 'baixa'
  return null
}

function tone(value: string): Tom | null {
  const text = normalizeText(value)
  if (text.includes('critic')) return 'critico'
  if (text.includes('negativ')) return 'negativo'
  if (text.includes('positiv')) return 'positivo'
  if (text.includes('neutr') || text.includes('tecnic')) return 'neutro'
  return null
}

export function parseHtmlReferenceReport(bytes: Uint8Array, filename: string): ParsedHtmlReport {
  const html = new TextDecoder('utf-8').decode(bytes)
  const $ = cheerio.load(html)
  $('script, style, noscript, svg').remove()
  const title =
    cleanArticleText($('title').first().text()) ||
    cleanArticleText($('h1').first().text()) ||
    filename.replace(/\.html?$/i, '')
  const extractedText = cleanArticleText($('body').text())
  const defaultYear = Number(`${filename} ${title} ${extractedText.slice(0, 1000)}`.match(/\b(20\d{2})\b/)?.[1] || new Date().getFullYear())
  const tables = $('table')
    .toArray()
    .map((table) => {
      const rows = $(table).find('tr').toArray()
      const headers = $(rows[0])
        .find('th,td')
        .toArray()
        .map((cell) => normalizeText(cellText($, cell)))
      return { table, rows, headers }
    })
  const evidenceTable = tables
    .filter(({ headers }) => findColumn(headers, ['titulo', 'materia']) >= 0)
    .sort((a, b) => b.rows.length - a.rows.length)[0]
  const evidence: ParsedReferenceEvidence[] = []
  if (evidenceTable) {
    const { headers } = evidenceTable
    const titleColumn = findColumn(headers, ['titulo', 'materia'])
    const publisherColumn = findColumn(headers, ['veiculo', 'fonte'])
    const authorColumn = findColumn(headers, ['jornalista', 'assinatura', 'autor'])
    const dateColumn = findColumn(headers, ['data'])
    const relevanceColumn = findColumn(headers, ['relev'])
    const toneColumn = findColumn(headers, ['tom'])
    for (const [index, row] of evidenceTable.rows.slice(1).entries()) {
      const cells = $(row).find('th,td').toArray()
      const itemTitle = cellText($, cells[titleColumn])
      if (!itemTitle) continue
      evidence.push({
        row_number: index + 1,
        title: itemTitle,
        publisher: publisherColumn >= 0 ? cellText($, cells[publisherColumn]) || null : null,
        author: authorColumn >= 0 ? cellText($, cells[authorColumn]) || null : null,
        published_at: dateColumn >= 0 ? parseDate(cellText($, cells[dateColumn]), defaultYear) : null,
        relevance: relevanceColumn >= 0 ? relevance(cellText($, cells[relevanceColumn])) : null,
        tone: toneColumn >= 0 ? tone(cellText($, cells[toneColumn])) : null,
      })
    }
  }
  const themes = tables
    .filter(({ headers }) => headers.some((header) => header.includes('tema estrategico')))
    .flatMap(({ rows }) =>
      rows.slice(1).map((row) => {
        const cells = $(row).find('th,td').toArray()
        return {
          theme: cellText($, cells[0]),
          relevance: cellText($, cells[1]),
          signal: cellText($, cells[2]),
        }
      })
    )
    .filter((item) => item.theme)
  const strategicReadings = $('strong, b')
    .filter((_, element) => normalizeText($(element).text()).includes('leitura estrategica'))
    .map((_, element) => cleanArticleText($(element).parent().text()))
    .get()
    .filter(Boolean)

  return {
    title,
    extractedText,
    evidence,
    metadata: {
      detected_type: 'relatorio',
      source_format: 'html',
      evidence_count: evidence.length,
      themes,
      strategic_readings: strategicReadings,
    },
  }
}
