import { normalizeText } from '@/lib/relevance'
import { safeExternalUrl } from '@/lib/url'

/** Palavras iniciais do título que identificam o mesmo fato em vários veículos. */
const SAME_STORY_WORDS = 6

export type Row = {
  article_id: string
  cita_cliente: boolean | null
  monitoring_status: string | null
  articles: { title: string; url: string | null; resolved_url: string | null; publisher: string | null; published_at: string | null }
}

export type DigestStory = {
  title: string
  publishers: string[]
  links: string[]
  citesClient: boolean
}

export type DailyDigest = { day: string; total: number; client: DigestStory[]; sector: DigestStory[] }

const storyKey = (title: string) => normalizeText(title).split(' ').slice(0, SAME_STORY_WORDS).join(' ')

/** Agrupa o mesmo fato publicado por vários veículos, como no resumo diário que os clientes recebem. */
export function buildDailyDigest(day: string, rows: Row[]): DailyDigest {
  const stories = new Map<string, DigestStory>()
  for (const row of rows.filter((item) => item.monitoring_status !== 'excluido')) {
    const key = storyKey(row.articles.title)
    const story = stories.get(key) ?? { title: row.articles.title, publishers: [], links: [], citesClient: false }
    const publisher = row.articles.publisher ?? 'veículo não informado'
    if (!story.publishers.includes(publisher)) story.publishers.push(publisher)
    const link = safeExternalUrl(row.articles.resolved_url || row.articles.url)
    if (link && !story.links.includes(link)) story.links.push(link)
    story.citesClient ||= Boolean(row.cita_cliente)
    stories.set(key, story)
  }
  const all = [...stories.values()].sort((a, b) => b.publishers.length - a.publishers.length)
  return { day, total: rows.length, client: all.filter((story) => story.citesClient), sector: all.filter((story) => !story.citesClient) }
}

/** Texto no formato do resumo diário. Tom fica pendente até a análise (IA ou editor). */
export function digestText(clientName: string, digest: DailyDigest) {
  const line = (story: DigestStory) =>
    `${story.publishers.join(', ')} ${story.publishers.length > 1 ? 'publicaram' : 'publicou'}: "${story.title}". Tom: pendente.${story.links[0] ? ` ${story.links[0]}` : ''}`
  return [
    `Resumo diário ${clientName} — ${digest.day.split('-').reverse().join('/')}`,
    'Rascunho gerado a partir das matérias coletadas; conferir antes de enviar.',
    '',
    ...digest.client.map(line),
    '',
    '---',
    'No setor:',
    ...digest.sector.slice(0, 8).map(line),
  ].join('\n')
}

