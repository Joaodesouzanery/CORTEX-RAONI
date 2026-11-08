import { normalizeText } from '@/lib/relevance'
import { safeExternalUrl } from '@/lib/url'
import { toneSentence } from '@/lib/clipping-text'
import type { Tom } from '@/types'

/** Palavras iniciais do título que identificam o mesmo fato em vários veículos. */
const SAME_STORY_WORDS = 6

export type Row = {
  article_id: string
  cita_cliente: boolean | null
  monitoring_status: string | null
  /** Tom da etiqueta (regra, IA ou editor). Ausente em linhas antigas = técnica. */
  tom?: Tom | null
  articles: { title: string; url: string | null; resolved_url: string | null; publisher: string | null; published_at: string | null }
}

export type DigestStory = {
  title: string
  publishers: string[]
  links: string[]
  citesClient: boolean
  /** O mais severo entre os veículos: um negativo pesa sobre o fato. */
  tone: Tom | null
}

export type DailyDigest = { day: string; total: number; client: DigestStory[]; sector: DigestStory[] }

const storyKey = (title: string) => normalizeText(title).split(' ').slice(0, SAME_STORY_WORDS).join(' ')

/** Agrupa o mesmo fato publicado por vários veículos, como no resumo diário que os clientes recebem. */
export function buildDailyDigest(day: string, rows: Row[]): DailyDigest {
  const stories = new Map<string, DigestStory>()
  for (const row of rows.filter((item) => item.monitoring_status !== 'excluido')) {
    const key = storyKey(row.articles.title)
    const story = stories.get(key) ?? { title: row.articles.title, publishers: [], links: [], citesClient: false, tone: null }
    const publisher = row.articles.publisher ?? 'veículo não informado'
    if (!story.publishers.includes(publisher)) story.publishers.push(publisher)
    const link = safeExternalUrl(row.articles.resolved_url || row.articles.url)
    if (link && !story.links.includes(link)) story.links.push(link)
    story.citesClient ||= Boolean(row.cita_cliente)
    if (row.tom === 'negativo' || row.tom === 'critico') story.tone = 'negativo'
    else if (row.tom === 'positivo' && story.tone !== 'negativo') story.tone = 'positivo'
    else if (row.tom && !story.tone) story.tone = row.tom
    stories.set(key, story)
  }
  const all = [...stories.values()].sort((a, b) => b.publishers.length - a.publishers.length)
  return { day, total: rows.length, client: all.filter((story) => story.citesClient), sector: all.filter((story) => !story.citesClient) }
}

/**
 * Texto no formato do resumo diário (docs/referencia-relatorios/2026-10-destaques/
 * formato-clipping-diario.md): menção ao cliente fecha com o tom; setor sem tom.
 * Antes saía "Tom: pendente" em toda linha. O tom vem da etiqueta, e o editor
 * ou a IA o corrigem na tela.
 */
export function digestText(clientName: string, digest: DailyDigest) {
  const line = (story: DigestStory, withTone: boolean) =>
    `${story.publishers.join(', ')} ${story.publishers.length > 1 ? 'publicaram' : 'publicou'}: "${story.title}".${withTone ? ` ${toneSentence(story.tone)}` : ''}${story.links[0] ? ` ${story.links[0]}` : ''}`
  return [
    `Resumo diário ${clientName} — ${digest.day.split('-').reverse().join('/')}`,
    'Rascunho gerado a partir das matérias coletadas; conferir antes de enviar.',
    '',
    ...digest.client.map((story) => line(story, true)),
    '',
    '---',
    'No setor:',
    ...digest.sector.slice(0, 8).map((story) => line(story, false)),
  ].join('\n')
}

