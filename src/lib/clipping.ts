import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/report-drafts'

// Clipping diário por cliente, no formato do clipping da ONS: bloco Cliente
// (cita o cliente) e bloco Setor (regra de setor qualificada, confirmado ou
// candidato). 100% automático por decisão do dono; 'revisao' fica de fora.

export interface ClippingItem {
  id: string
  title: string
  url: string | null
  publisher: string | null
  published_at: string | null
  content_status: string | null
  tema: string | null
}

export interface ClippingDay {
  date: string
  start: string
  end: string
  client: ClippingItem[]
  sector: ClippingItem[]
  sources: { ok: number; failed: Array<{ name: string; error: string | null }> }
}

/** Limites do dia no horário de Brasília (UTC-3, sem horário de verão desde 2019). */
export function saoPauloDayBounds(date: string) {
  const start = new Date(`${date}T00:00:00-03:00`)
  const end = new Date(start.getTime() + 86_400_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

type Row = {
  article_id: string
  cita_cliente: boolean | null
  monitoring_status: string
  tema: string | null
  articles: { title: string; url: string | null; resolved_url: string | null; publisher: string | null; published_at: string | null; content_status: string | null } | null
}

export function splitClipping(rows: Row[]): Pick<ClippingDay, 'client' | 'sector'> {
  const client: ClippingItem[] = []
  const sector: ClippingItem[] = []
  for (const row of rows) {
    if (!row.articles) continue
    const item: ClippingItem = {
      id: row.article_id,
      title: row.articles.title,
      url: row.articles.resolved_url || row.articles.url,
      publisher: row.articles.publisher,
      published_at: row.articles.published_at,
      content_status: row.articles.content_status,
      tema: row.tema,
    }
    if (row.cita_cliente) client.push(item)
    else if (row.monitoring_status === 'confirmado' || row.monitoring_status === 'candidato') sector.push(item)
  }
  const byTime = (a: ClippingItem, b: ClippingItem) => String(b.published_at).localeCompare(String(a.published_at))
  return { client: client.sort(byTime), sector: sector.sort(byTime) }
}

export async function loadClippingDay(supabase: SupabaseClient, clientId: string, date: string): Promise<ClippingDay> {
  const { start, end } = saoPauloDayBounds(date)
  const rows = await fetchAll<Row>((from, to) =>
    supabase
      .from('article_client_tags')
      .select('article_id, cita_cliente, monitoring_status, tema, articles!inner(title, url, resolved_url, publisher, published_at, content_status)')
      .eq('client_id', clientId)
      .neq('monitoring_status', 'excluido')
      .gte('articles.published_at', start)
      .lt('articles.published_at', end)
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  )
  const { data: sourceRows, error: sourceError } = await supabase
    .from('fetch_run_sources')
    .select('status, error, started_at, sources(name)')
    .gte('started_at', start)
    .lt('started_at', end)
    .limit(5000)
  if (sourceError) throw new Error(`Saúde das fontes indisponível (${sourceError.code}).`)
  // Última tentativa por fonte no dia: falhou e depois funcionou conta como OK.
  const latest = new Map<string, { status: string; error: string | null; started_at: string }>()
  for (const row of (sourceRows || []) as unknown as Array<{ status: string; error: string | null; started_at: string; sources: { name: string } | null }>) {
    const name = row.sources?.name || 'fonte sem nome'
    const current = latest.get(name)
    if (!current || row.started_at > current.started_at) latest.set(name, row)
  }
  const failed = [...latest.entries()]
    .filter(([, row]) => row.status === 'erro')
    .map(([name, row]) => ({ name, error: row.error }))
  return { date, start, end, ...splitClipping(rows), sources: { ok: latest.size - failed.length, failed } }
}
