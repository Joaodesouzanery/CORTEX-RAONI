// Dados do e-mail de clipping de um cliente num dia (America/Sao_Paulo).
// Falha do Supabase propaga (fetchAll lança): e-mail vazio por erro mentiria
// para o cliente que "não houve notícia".

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAll } from '@/lib/report-drafts'
import { buildClippingDays, type ClippingDay, type ClippingItem } from '@/lib/clipping-text'
import type { Tom } from '@/types'

type Row = {
  article_id: string
  cita_cliente: boolean | null
  tom: Tom | null
  classification_source: string | null
  impact_summary: string | null
  articles: {
    title: string
    url: string | null
    resolved_url: string | null
    publisher: string | null
    published_at: string | null
    sources: { name: string } | Array<{ name: string }> | null
  }
}

/** Ontem em São Paulo: o e-mail das 7h cobre o dia anterior inteiro. */
export function defaultClippingDay(now = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterday)
}

export interface ClippingDayData {
  day: ClippingDay | null
  total: number
}

export async function loadClippingDay(
  supabase: SupabaseClient,
  clientId: string,
  day: string,
  /** 'omit' no e-mail que vai ao cliente: tom não revisado não é afirmado. */
  unreviewedTone: 'mark' | 'omit' = 'mark'
): Promise<ClippingDayData> {
  const start = new Date(`${day}T00:00:00-03:00`).toISOString()
  const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const rows = await fetchAll<Row>((from, to) =>
    supabase
      .from('article_client_tags')
      .select('article_id, cita_cliente, tom, classification_source, impact_summary, articles!inner(title, url, resolved_url, publisher, published_at, sources(name))')
      .eq('client_id', clientId)
      .neq('monitoring_status', 'excluido')
      .gte('articles.published_at', start)
      .lt('articles.published_at', end)
      // Ordem estável na tabela-pai: order em tabela embutida não ordena as
      // páginas do range, e acima de 1000 linhas elas poderiam se sobrepor.
      .order('article_id', { ascending: true })
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  )
  const items: ClippingItem[] = rows.map((row) => {
    const source = Array.isArray(row.articles.sources) ? row.articles.sources[0] : row.articles.sources
    return {
      id: row.article_id,
      published_at: row.articles.published_at,
      outlet: row.articles.publisher || source?.name || 'Veículo não identificado',
      title: row.articles.title,
      url: row.articles.resolved_url || row.articles.url,
      cites_client: row.cita_cliente === true,
      tone: row.tom,
      summary: row.impact_summary,
      tone_reviewed: row.classification_source === 'humano' || row.classification_source === 'ia',
    }
  })
  const days = buildClippingDays(items, { unreviewedTone })
  return { day: days.find((candidate) => candidate.day === day) ?? null, total: rows.length }
}

export interface ClippingBrand {
  displayName: string
  brand: string
}

export async function clippingBrand(supabase: SupabaseClient, clientId: string): Promise<ClippingBrand> {
  const [{ data: client, error: clientError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('clients').select('name, contratante').eq('id', clientId).maybeSingle(),
    supabase.from('client_report_profiles').select('brand, display_name').eq('client_id', clientId).maybeSingle(),
  ])
  if (clientError) throw new Error(clientError.message)
  if (profileError) throw new Error(profileError.message)
  if (!client) throw new Error('Cliente não encontrado.')
  return { displayName: profile?.display_name || client.name, brand: profile?.brand || client.contratante || 'CORTEX' }
}
