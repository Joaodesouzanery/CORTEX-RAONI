// Backfill de um mês já passado (Fase 22): reconstrói o que o RSS não devolve
// mais. Feed RSS só traz as últimas dezenas de itens, e a coleta agendada
// ficou parada de 15/09 a 14/11/2026: outubro inteiro não estava no acervo.
// A busca do Google News aceita janela (after:/before:), então montamos, por
// cliente, consultas com os termos diretos e os temas do mês, e gravamos pelo
// mesmo RPC idempotente da coleta (re-run é no-op ou update, nunca duplicata).
//
// Os links vêm do Google News: o passo "Resolve Google News links" do
// fetch-news troca pela URL real depois (e reclassifica).

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRSS } from '@/lib/fetcher/rss'
import { canonicalArticleFingerprint, inferContentStatus } from '@/lib/archive'
import { classifyArticleBatch } from '@/lib/classification'
import { monthBounds } from '@/lib/report-drafts'
import type { Article } from '@/types'

/** Termos por consulta: a URL do Google News fica abaixo de ~2 mil caracteres. */
const TERMS_PER_QUERY = 6
/** Teto de consultas por cliente por mês: termos demais viram ruído e tempo. */
const MAX_QUERIES_PER_CLIENT = 12

export interface BackfillClient {
  id: string
  name: string
  directTerms: string[]
  themeTerms: string[]
}

export interface BackfillQuery {
  client_id: string
  client: string
  url: string
  terms: string[]
}

function quoteTerm(term: string): string {
  const clean = term.replace(/["()]/g, ' ').replace(/\s+/g, ' ').trim()
  return /\s/.test(clean) ? `"${clean}"` : clean
}

function nextDay(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

/** Consultas determinísticas: a mesma lista em toda chamada, para o cursor andar. */
export function buildBackfillQueries(clients: BackfillClient[], period: string): BackfillQuery[] {
  const { date } = monthBounds(period)
  const [year, month] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  // before: é exclusivo no Google News; after: também. Dia antes e dia depois.
  const after = new Date(`${date}T12:00:00Z`)
  after.setUTCDate(after.getUTCDate() - 1)
  const window = `after:${after.toISOString().slice(0, 10)} before:${nextDay(lastDay)}`
  const queries: BackfillQuery[] = []
  for (const client of [...clients].sort((a, b) => a.name.localeCompare(b.name))) {
    // Termo direto primeiro (cita o cliente), depois frases dos temas. Palavra
    // solta de tema fica de fora: no Google News ela traz o país inteiro.
    const terms = Array.from(
      new Set([...client.directTerms, ...client.themeTerms.filter((term) => /\s/.test(term.trim()) || /^[A-Z0-9-]{2,8}$/.test(term.trim()))])
    ).filter((term) => term.trim().length >= 3)
    const chunks: string[][] = []
    for (let index = 0; index < terms.length && chunks.length < MAX_QUERIES_PER_CLIENT; index += TERMS_PER_QUERY) {
      chunks.push(terms.slice(index, index + TERMS_PER_QUERY))
    }
    for (const chunk of chunks) {
      const q = `(${chunk.map(quoteTerm).join(' OR ')}) ${window}`
      queries.push({
        client_id: client.id,
        client: client.name,
        terms: chunk,
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`,
      })
    }
  }
  return queries
}

export interface BackfillStepResult {
  client: string
  parsed: number
  in_period: number
  inserted: number
  matches: number
}

/** Uma consulta por chamada (cabe nos 60 s da Vercel); o workflow avança o cursor. */
export async function runBackfillQuery(
  supabase: SupabaseClient,
  query: BackfillQuery,
  period: string,
  sourceId: string
): Promise<BackfillStepResult> {
  const bounds = monthBounds(period)
  const raw = await fetchRSS(query.url)
  // O Google News às vezes devolve item fora da janela: só entra o do mês.
  const inPeriod = raw.filter((item) => item.published_at && item.published_at >= bounds.start && item.published_at < bounds.end)
  const articles = await Promise.all(
    inPeriod.map(async (item) => ({
      ...item,
      content_status: inferContentStatus(item.content, item.excerpt),
      canonical_fingerprint: await canonicalArticleFingerprint(item),
    }))
  )
  if (!articles.length) return { client: query.client, parsed: raw.length, in_period: 0, inserted: 0, matches: 0 }
  const { data: ingested, error } = await supabase.rpc('ingest_source_articles', {
    p_source_id: sourceId,
    p_acquisition_type: 'rss',
    p_articles: articles,
  })
  if (error) throw new Error(error.message)
  const rows = (ingested as Array<{ article_id: string; inserted: boolean }>) || []
  const ids = Array.from(new Set(rows.map((row) => row.article_id)))
  let matches = 0
  if (ids.length) {
    const { data: saved, error: savedError } = await supabase.from('articles').select('*, sources(name, categoria, is_general)').in('id', ids)
    if (savedError) throw new Error(savedError.message)
    matches = (await classifyArticleBatch(supabase, (saved as unknown as Article[]) || [])).matches
  }
  return { client: query.client, parsed: raw.length, in_period: inPeriod.length, inserted: rows.filter((row) => row.inserted).length, matches }
}
