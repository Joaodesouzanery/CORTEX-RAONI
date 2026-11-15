// Destaques do mês por cliente: 4 a 8 eixos, como o resumo que cada cliente
// recebeu em outubro (docs/referencia-relatorios/2026-10-destaques/).
//
// Determinístico (rascunho automático): agrupa as matérias do mês pelos temas
// do cliente (client_report_topic_templates) e, se faltar eixo, por pauta
// repetida em vários veículos. Cada eixo carrega a contagem com denominador e
// os links que o sustentam — eixo sem matéria não existe aqui (nunca inventar;
// os destaques recebidos tinham trechos sem evidência, ver o README de lá).
// A IA, quando ligada, só reescreve a linha de cada eixo.

import { linkStatus, normalize, overlap, topicKey, MAJOR_OUTLETS, SAME_TOPIC_OVERLAP } from '@/lib/report-selection'
import { safeExternalUrl } from '@/lib/url'

export interface HighlightItem {
  id: string
  title: string
  excerpt?: string | null
  url: string | null
  outlet: string
  published_at: string | null
  cites_client: boolean
}

export interface HighlightTheme {
  title: string
  inclusion_terms: string[]
  exclusion_terms?: string[]
}

export interface Highlight {
  title: string
  /** 'tema' = tema cadastrado do cliente; 'pauta' = fato repetido em vários veículos. */
  origin: 'tema' | 'pauta'
  count: number
  client_count: number
  outlets: string[]
  lead: HighlightItem
  links: Array<{ outlet: string; title: string; url: string; date: string | null }>
}

export interface HighlightOptions {
  min?: number
  max?: number
  /** Nome que nunca sai no relatório (PetroRecôncavo na PRIO): tira a matéria. */
  forbiddenTerms?: string[]
  /** Exclusões das regras de setor: tiram só a matéria que não cita o cliente. */
  sectorExcludeTerms?: string[]
}

/** Os resumos de outubro tinham de 4 (ONS) a 8 (DAQ) eixos. */
export const MIN_HIGHLIGHTS = 4
export const MAX_HIGHLIGHTS = 8
/** Links por eixo no pacote: o suficiente para o leitor conferir. */
const LINKS_PER_HIGHLIGHT = 3

const termList = (terms: string[]) => terms.map(normalize).filter((term) => term.length >= 2)

function matches(item: HighlightItem, include: string[], exclude: string[]): boolean {
  const text = ` ${normalize(`${item.title} ${item.excerpt || ''}`)} `
  if (exclude.some((term) => text.includes(` ${term} `))) return false
  return include.some((term) => text.includes(` ${term} `))
}

function rank(items: HighlightItem[]): HighlightItem[] {
  return [...items].sort(
    (a, b) =>
      Number(b.cites_client) - Number(a.cites_client) ||
      Number(linkStatus(b.url) === 'exato') - Number(linkStatus(a.url) === 'exato') ||
      Number(MAJOR_OUTLETS.test(b.outlet)) - Number(MAJOR_OUTLETS.test(a.outlet)) ||
      String(b.published_at).localeCompare(String(a.published_at))
  )
}

function build(title: string, origin: Highlight['origin'], items: HighlightItem[]): Highlight {
  const ranked = rank(items)
  const outlets: string[] = []
  for (const item of ranked) if (!outlets.includes(item.outlet)) outlets.push(item.outlet)
  const seen = new Set<string>()
  const links = ranked.flatMap((item) => {
    const url = item.url && linkStatus(item.url) === 'exato' ? safeExternalUrl(item.url) : null
    if (!url || seen.has(url)) return []
    seen.add(url)
    return [{ outlet: item.outlet, title: item.title, url, date: item.published_at }]
  })
  return {
    title,
    origin,
    count: items.length,
    client_count: items.filter((item) => item.cites_client).length,
    outlets,
    lead: ranked[0],
    links: links.slice(0, LINKS_PER_HIGHLIGHT),
  }
}

// Peso do eixo: matéria que cita o cliente vale três de setor — é a voz dele
// que os resumos de outubro destacavam primeiro.
const score = (highlight: Highlight) => highlight.client_count * 3 + highlight.count

export function buildHighlights(items: HighlightItem[], themes: HighlightTheme[], options: HighlightOptions = {}): Highlight[] {
  const min = options.min ?? MIN_HIGHLIGHTS
  const max = options.max ?? MAX_HIGHLIGHTS
  // Mesmos filtros da seleção das 20: título de pauta vira nome de eixo, e um
  // nome proibido ali iria parar no pacote do cliente.
  const forbidden = termList(options.forbiddenTerms || [])
  const sectorExclude = termList(options.sectorExcludeTerms || [])
  items = items.filter((item) => {
    const title = ` ${normalize(item.title)} `
    if (forbidden.some((term) => title.includes(` ${term} `))) return false
    return item.cites_client || !sectorExclude.some((term) => title.includes(` ${term} `))
  })
  const used = new Set<string>()
  const byTheme = themes
    .map((theme) => {
      const include = termList(theme.inclusion_terms)
      const exclude = termList(theme.exclusion_terms || [])
      return { theme, items: include.length ? items.filter((item) => matches(item, include, exclude)) : [] }
    })
    // Eixo precisa de massa: duas matérias, ou uma que cite o cliente.
    .filter(({ items: matched }) => matched.length >= 2 || matched.some((item) => item.cites_client))
    .map(({ theme, items: matched }) => build(theme.title, 'tema', matched))
    .sort((a, b) => score(b) - score(a))
    .slice(0, max)
  for (const highlight of byTheme) for (const link of highlight.links) used.add(link.url)

  if (byTheme.length >= min) return byTheme

  // Completa com fatos repetidos em vários veículos que nenhum tema pegou.
  const stories: Array<{ key: Set<string>; items: HighlightItem[] }> = []
  for (const item of rank(items)) {
    if (item.url && used.has(item.url)) continue
    const key = topicKey(item.title)
    const story = stories.find((candidate) => overlap(candidate.key, key) >= SAME_TOPIC_OVERLAP)
    if (story) story.items.push(item)
    else stories.push({ key, items: [item] })
  }
  const extra = stories
    .filter((story) => story.items.length >= 2)
    .map((story) => build(rank(story.items)[0].title, 'pauta', story.items))
    .sort((a, b) => score(b) - score(a))
  return [...byTheme, ...extra].slice(0, Math.max(min, byTheme.length))
}

function day(iso: string | null): string {
  if (!iso) return 's/d'
  const [, month, dayOfMonth] = iso.slice(0, 10).split('-')
  return `${dayOfMonth}/${month}`
}

// Texto de terceiro no .md: sem quebra de linha (forjaria título ou bloco de
// instrução no pacote), sem colchete (abriria link), sem barra (quebra tabela).
const safe = (text: string) => text.replace(/\s+/g, ' ').trim().replace(/\[/g, '(').replace(/\]/g, ')').replace(/\|/g, '/')
const safeUrl = (url: string) => url.replace(/\(/g, '%28').replace(/\)/g, '%29')

export function highlightsMarkdown(highlights: Highlight[], context: { total: number; periodLabel: string }): string {
  if (!highlights.length) {
    return `Sem eixo com massa suficiente nas ${context.total} matérias do período: os destaques ficam para a curadoria.`
  }
  const head = `Rascunho automático. Contagens sobre ${context.total} matérias de ${context.periodLabel} etiquetadas para o cliente (fora as excluídas). Cada eixo traz os links que o sustentam.`
  const body = highlights.map((highlight, index) => {
    const outlets = highlight.outlets.slice(0, 5).join(', ') + (highlight.outlets.length > 5 ? ` e mais ${highlight.outlets.length - 5}` : '')
    const links = highlight.links.map((link) => `  - [${safe(link.title)}](${safeUrl(link.url)}) — ${safe(link.outlet)}, ${day(link.date)}`)
    return [
      `${index + 1}. **${safe(highlight.title)}** — ${highlight.count} matéria${highlight.count === 1 ? '' : 's'}${highlight.client_count ? `, ${highlight.client_count} citando o cliente` : ''}. Veículos: ${safe(outlets)}.`,
      ...links,
    ].join('\n')
  })
  return [head, '', ...body].join('\n')
}
