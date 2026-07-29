import type { SupabaseClient } from '@supabase/supabase-js'
import type { Article, Source } from '@/types'
import { fetchFromSource } from '@/lib/fetcher'
import { canonicalArticleFingerprint, inferContentStatus } from '@/lib/archive'
import { classifyArticleBatch } from '@/lib/classification'
import { normalizeText } from '@/lib/relevance'

const SOURCE_TIMEOUT_MS = 25_000

type IngestRow = {
  article_id: string
  article_url: string
  inserted: boolean
  enriched: boolean
}

export interface ProcessSourceResult {
  source_id: string
  source: string
  parsed: number
  inserted: number
  updated: number
  duplicates: number
  classified: number
  duration_ms: number
  error?: string
  retrying?: boolean
}

function isNavigationPage(title: string): boolean {
  const normalized = normalizeText(title)
  return (
    !normalized ||
    /^(login|entrar|inicio|home|acesso a informacao|perguntas frequentes|mapa do site)$/.test(normalized) ||
    normalized.startsWith('erro 404') ||
    normalized.startsWith('pagina nao encontrada')
  )
}

function dateRange(values: Array<string | null>): { oldest: string | null; latest: string | null } {
  const dates = values.filter(Boolean).sort() as string[]
  return { oldest: dates[0] || null, latest: dates.at(-1) || null }
}

export async function processFetchSource(
  supabase: SupabaseClient,
  runId: string,
  source: Source,
  attemptCount = 1
): Promise<ProcessSourceResult> {
  const started = Date.now()
  try {
    const raw = await Promise.race([
      fetchFromSource(source.url, source.type),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de ${SOURCE_TIMEOUT_MS / 1000}s`)), SOURCE_TIMEOUT_MS)
      ),
    ])
    const byUrl = new Map(raw.filter((article) => article.url && !isNavigationPage(article.title)).map((article) => [article.url, article]))
    const articles = await Promise.all(
      Array.from(byUrl.values())
        .slice(0, 100)
        .map(async (article) => {
          const prepared = {
            ...article,
            publisher: article.publisher || source.name,
          }
          return {
            ...prepared,
            content_status: inferContentStatus(prepared.content, prepared.excerpt),
            canonical_fingerprint: await canonicalArticleFingerprint(prepared),
          }
        })
    )

    const { data: ingested, error: ingestError } = await supabase.rpc('ingest_source_articles', {
      p_source_id: source.id,
      p_acquisition_type: source.type,
      p_articles: articles,
    })
    if (ingestError) throw new Error(ingestError.message)
    const rows = (ingested as IngestRow[]) || []
    const ids = Array.from(new Set(rows.map((row) => row.article_id)))
    let classified = 0
    if (ids.length) {
      const { data: saved, error: articlesError } = await supabase
        .from('articles')
        .select('*, sources(name, categoria, is_general)')
        .in('id', ids)
      if (articlesError) throw new Error(articlesError.message)
      const result = await classifyArticleBatch(supabase, (saved as unknown as Article[]) || [])
      classified = result.matches
    }

    const inserted = rows.filter((row) => row.inserted).length
    const updated = rows.filter((row) => !row.inserted && row.enriched).length
    const duplicates = rows.filter((row) => !row.inserted && !row.enriched).length
    const duration = Date.now() - started
    const range = dateRange(articles.map((article) => article.published_at))
    const now = new Date().toISOString()

    await Promise.all([
      supabase
        .from('fetch_run_sources')
        .update({
          status: 'concluido',
          parsed_count: articles.length,
          inserted_count: inserted,
          updated_count: updated,
          duplicate_count: duplicates,
          duration_ms: duration,
          oldest_published_at: range.oldest,
          latest_published_at: range.latest,
          finished_at: now,
        })
        .eq('run_id', runId)
        .eq('source_id', source.id),
      supabase
        .from('sources')
        .update({
          last_fetch_count: articles.length,
          last_fetched_at: now,
          last_success_at: now,
          last_fetch_error: null,
          last_fetch_duration_ms: duration,
        })
        .eq('id', source.id),
    ])

    return {
      source_id: source.id,
      source: source.name,
      parsed: articles.length,
      inserted,
      updated,
      duplicates,
      classified,
      duration_ms: duration,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida'
    const duration = Date.now() - started
    const retrying = attemptCount < 2
    await supabase
      .from('fetch_run_sources')
      .update({
        status: retrying ? 'pendente' : 'erro',
        error: message.slice(0, 2000),
        duration_ms: duration,
        finished_at: retrying ? null : new Date().toISOString(),
      })
      .eq('run_id', runId)
      .eq('source_id', source.id)
    if (!retrying) {
      await supabase
        .from('sources')
        .update({
          last_fetch_count: 0,
          last_fetched_at: new Date().toISOString(),
          last_fetch_error: message.slice(0, 2000),
          last_fetch_duration_ms: duration,
        })
        .eq('id', source.id)
    }
    return {
      source_id: source.id,
      source: source.name,
      parsed: 0,
      inserted: 0,
      updated: 0,
      duplicates: 0,
      classified: 0,
      duration_ms: duration,
      error: message,
      retrying,
    }
  }
}

export async function refreshFetchRun(supabase: SupabaseClient, runId: string) {
  const { data: rows, error } = await supabase
    .from('fetch_run_sources')
    .select('status, parsed_count, inserted_count, updated_count, duplicate_count')
    .eq('run_id', runId)
  if (error) throw new Error(error.message)
  const sources = rows || []
  const completed = sources.filter((row) => row.status === 'concluido' || row.status === 'erro').length
  const errors = sources.filter((row) => row.status === 'erro').length
  const done = completed === sources.length
  const status = done ? (errors === 0 ? 'concluido' : errors === sources.length ? 'erro' : 'parcial') : 'executando'
  const patch = {
    status,
    completed_sources: completed,
    parsed_count: sources.reduce((sum, row) => sum + row.parsed_count, 0),
    inserted_count: sources.reduce((sum, row) => sum + row.inserted_count, 0),
    updated_count: sources.reduce((sum, row) => sum + row.updated_count, 0),
    duplicate_count: sources.reduce((sum, row) => sum + row.duplicate_count, 0),
    error_count: errors,
    finished_at: done ? new Date().toISOString() : null,
  }
  const { data: run, error: updateError } = await supabase
    .from('fetch_runs')
    .update(patch)
    .eq('id', runId)
    .select()
    .single()
  if (updateError) throw new Error(updateError.message)
  return run
}
