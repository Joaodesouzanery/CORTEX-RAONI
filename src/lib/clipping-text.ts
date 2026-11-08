// Texto de clipping no formato que a ONS recebe do fornecedor
// (docs/referencia-relatorios/2026-10-destaques/formato-clipping-diario.md):
// por dia, primeiro as menções ao cliente — um parágrafo por fato, com os
// veículos que o publicaram e o tom —, depois "Em setor," com poucos itens e
// sem tom.
//
// Determinístico, sem IA (decisão do dono em 08/11/2026: modelo fixo agora, a
// IA reescreve por cima quando a chave for ligada). Por isso o texto CITA o
// título entre aspas em vez de parafrasear: citar título, veículo, data e link
// é referência; reescrever o lead do veículo seria reproduzir texto de
// terceiro. O resumo só entra quando é texto nosso (impact_summary escrito
// por pessoa ou IA), nunca o excerpt do veículo.
//
// Título de terceiro é DADO: aqui ele só vira texto entre aspas. Quem renderiza
// HTML escapa (src/lib/clipping-email.ts); o markdown troca colchete e
// barra vertical para não abrir link nem quebrar tabela.

import { normalize, overlap, topicKey, MAJOR_OUTLETS, SAME_TOPIC_OVERLAP, linkStatus } from '@/lib/report-selection'
import type { Tom } from '@/types'

export interface ClippingItem {
  id: string
  /** ISO; o dia é calculado em America/Sao_Paulo. */
  published_at: string | null
  outlet: string
  title: string
  url: string | null
  cites_client: boolean
  tone?: Tom | null
  /** Resumo próprio (impact_summary humano/IA). Excerpt do veículo NÃO entra aqui. */
  summary?: string | null
}

export interface ClippingParagraph {
  outlets: string[]
  title: string
  /** Link da matéria líder (exato quando houver). */
  url: string | null
  links: Array<{ outlet: string; url: string }>
  tone: Tom | null
  summary: string | null
  text: string
}

export interface ClippingDay {
  /** YYYY-MM-DD em America/Sao_Paulo. */
  day: string
  label: string
  client: ClippingParagraph[]
  sector: ClippingParagraph[]
}

export interface ClippingTextOptions {
  /** Itens de setor por dia. O fornecedor da ONS manda 2 ou 3. */
  sectorPerDay?: number
}

/** Dois a três parágrafos de setor por dia, como no clipping que a ONS recebe. */
export const SECTOR_PER_DAY = 3

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
const LABEL_FORMAT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

export function saoPauloDay(iso: string): string {
  return DAY_FORMAT.format(new Date(iso))
}

function dayLabel(day: string): string {
  // Meio-dia UTC do próprio dia: o rótulo não escorrega para a véspera.
  const label = LABEL_FORMAT.format(new Date(`${day}T12:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

// "A menção foi técnica." — o fornecedor usa técnica para o neutro.
export function toneSentence(tone: Tom | null | undefined): string {
  if (tone === 'positivo') return 'A menção foi positiva.'
  if (tone === 'negativo' || tone === 'critico') return 'A menção foi negativa.'
  return 'A menção foi técnica.'
}

// Resumo automático genérico de classification.ts ("A publicação cita X
// diretamente.") não é resumo: não acrescenta nada ao título.
const BOILERPLATE_SUMMARY = /^(a publicação cita .+ diretamente|cobertura monitorada de .+)\.?$/i

function ownSummary(summary: string | null | undefined): string | null {
  const text = summary?.trim()
  if (!text || BOILERPLATE_SUMMARY.test(text)) return null
  return /[.!?]$/.test(text) ? text : `${text}.`
}

export function joinOutlets(outlets: string[]): string {
  if (outlets.length <= 1) return outlets[0] || 'Veículo não identificado'
  return `${outlets.slice(0, -1).join(', ')} e ${outlets[outlets.length - 1]}`
}

function quoteTitle(title: string): string {
  return `“${title.replace(/\s+/g, ' ').trim().replace(/[“”]/g, '"')}”`
}

interface Story {
  key: Set<string>
  items: ClippingItem[]
}

// Mesmo fato no mesmo dia em vários veículos vira um parágrafo, como "A Folha,
// UOL e Agência Infra divulgaram que…". Líder = grande veículo com link exato.
function groupStories(items: ClippingItem[]): Story[] {
  const stories: Story[] = []
  for (const item of items) {
    const key = topicKey(item.title)
    const story = stories.find((candidate) => overlap(candidate.key, key) >= SAME_TOPIC_OVERLAP)
    if (story) story.items.push(item)
    else stories.push({ key, items: [item] })
  }
  for (const story of stories) {
    story.items.sort(
      (a, b) =>
        Number(linkStatus(b.url) === 'exato') - Number(linkStatus(a.url) === 'exato') ||
        Number(MAJOR_OUTLETS.test(b.outlet)) - Number(MAJOR_OUTLETS.test(a.outlet)) ||
        String(a.published_at).localeCompare(String(b.published_at))
    )
  }
  return stories
}

function paragraph(story: Story, kind: 'client' | 'sector', opener = ''): ClippingParagraph {
  const lead = story.items[0]
  const outlets: string[] = []
  for (const item of story.items) {
    const outlet = item.outlet.trim() || 'Veículo não identificado'
    if (!outlets.some((existing) => normalize(existing) === normalize(outlet))) outlets.push(outlet)
  }
  const links = story.items.flatMap((item) => (item.url && linkStatus(item.url) === 'exato' ? [{ outlet: item.outlet, url: item.url }] : []))
  // Tom do fato = o mais severo entre as versões: um veículo negativo pesa.
  const tones = story.items.map((item) => item.tone).filter(Boolean) as Tom[]
  const tone: Tom | null = tones.includes('critico') || tones.includes('negativo') ? 'negativo' : tones.includes('positivo') ? 'positivo' : tones[0] ?? null
  const summary = story.items.map((item) => ownSummary(item.summary)).find(Boolean) ?? null
  const verb = outlets.length > 1 ? 'publicaram' : 'publicou'
  const sentence = `${opener}${joinOutlets(outlets)} ${verb} ${quoteTitle(lead.title)}.`
  const text = kind === 'client'
    ? [sentence, summary, toneSentence(tone)].filter(Boolean).join(' ')
    : [sentence, summary].filter(Boolean).join(' ')
  return { outlets, title: lead.title, url: links[0]?.url ?? lead.url ?? null, links, tone: kind === 'client' ? tone : null, summary, text }
}

const SECTOR_OPENERS = ['Em setor, ', '', '']

export function buildClippingDays(items: ClippingItem[], options: ClippingTextOptions = {}): ClippingDay[] {
  const sectorPerDay = options.sectorPerDay ?? SECTOR_PER_DAY
  const byDay = new Map<string, ClippingItem[]>()
  for (const item of items) {
    if (!item.published_at) continue
    const day = saoPauloDay(item.published_at)
    byDay.set(day, [...(byDay.get(day) || []), item])
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, dayItems]) => {
      const clientStories = groupStories(dayItems.filter((item) => item.cites_client))
      // Setor: grande veículo primeiro, só com link exato (o leitor precisa abrir).
      const sectorStories = groupStories(
        dayItems
          .filter((item) => !item.cites_client && linkStatus(item.url) === 'exato')
          .sort((a, b) => Number(MAJOR_OUTLETS.test(b.outlet)) - Number(MAJOR_OUTLETS.test(a.outlet)))
      ).slice(0, sectorPerDay)
      return {
        day,
        label: dayLabel(day),
        client: clientStories.map((story) => paragraph(story, 'client')),
        sector: sectorStories.map((story, index) => paragraph(story, 'sector', SECTOR_OPENERS[index] ?? '')),
      }
    })
    .filter((day) => day.client.length || day.sector.length)
}

function markdownSafe(text: string): string {
  return text.replace(/\[/g, '(').replace(/\]/g, ')').replace(/\|/g, '/')
}

function paragraphMarkdown(item: ClippingParagraph): string {
  const links = item.links.length
    ? ` ${item.links.map((link) => `[${markdownSafe(link.outlet)}](${link.url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`).join(' · ')}`
    : ''
  return `${markdownSafe(item.text)}${links}`
}

export function clippingMarkdown(days: ClippingDay[]): string {
  return days
    .map((day) =>
      [
        `### ${day.label}`,
        '',
        ...day.client.flatMap((item) => [paragraphMarkdown(item), '']),
        ...(day.client.length && day.sector.length ? ['---', ''] : []),
        ...day.sector.flatMap((item) => [paragraphMarkdown(item), '']),
      ].join('\n')
    )
    .join('\n')
}
