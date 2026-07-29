import type { SupabaseClient } from '@supabase/supabase-js'
import type { Article, ArticleTag, Client, ClientRelevanceRule } from '@/types'
import { evaluateClientArticle, mergeAutomatedEvaluation } from '@/lib/client-relevance'

type ClientForClassification = Client & {
  client_relevance_rules: ClientRelevanceRule[]
  client_sources: Array<{ source_id: string; is_thematic: boolean }>
}

export interface ClassificationBatchResult {
  articles: number
  matches: number
  removed: number
}

export async function classifyArticleBatch(
  supabase: SupabaseClient,
  articles: Article[]
): Promise<ClassificationBatchResult> {
  if (!articles.length) return { articles: 0, matches: 0, removed: 0 }
  const ids = articles.map((article) => article.id)
  const { data: clientRows, error: clientsError } = await supabase
    .from('clients')
    .select(
      '*, client_relevance_rules(*), client_sources(source_id, is_thematic)'
    )
    .eq('active', true)
  if (clientsError) throw new Error(clientsError.message)

  const { data: provenanceRows, error: provenanceError } = await supabase
    .from('article_provenance')
    .select('article_id, source_id')
    .in('article_id', ids)
    .not('source_id', 'is', null)
  if (provenanceError) throw new Error(provenanceError.message)

  const sourceIdsByArticle = new Map<string, Set<string>>()
  for (const article of articles) sourceIdsByArticle.set(article.id, new Set([article.source_id]))
  for (const row of provenanceRows || []) {
    if (!row.source_id) continue
    const sources = sourceIdsByArticle.get(row.article_id) || new Set<string>()
    sources.add(row.source_id)
    sourceIdsByArticle.set(row.article_id, sources)
  }

  const { data: currentRows, error: currentError } = await supabase
    .from('article_client_tags')
    .select('*')
    .in('article_id', ids)
  if (currentError) throw new Error(currentError.message)
  const current = new Map<string, ArticleTag>()
  for (const row of (currentRows as ArticleTag[]) || []) {
    current.set(`${row.article_id}:${row.client_id}`, row)
  }

  const now = new Date().toISOString()
  const upserts: Record<string, unknown>[] = []
  const matchedKeys = new Set<string>()
  const clients = (clientRows as unknown as ClientForClassification[]) || []

  for (const client of clients) {
    const thematic = new Set(
      (client.client_sources || []).filter((source) => source.is_thematic).map((source) => source.source_id)
    )
    for (const article of articles) {
      const sources = sourceIdsByArticle.get(article.id) || new Set<string>()
      const fromThematic = Array.from(sources).some((sourceId) => thematic.has(sourceId))
      const evaluation = evaluateClientArticle(
        client,
        client.client_relevance_rules || [],
        article,
        fromThematic
      )
      if (!evaluation) continue

      const key = `${article.id}:${client.id}`
      matchedKeys.add(key)
      const merged = mergeAutomatedEvaluation(current.get(key) || null, evaluation, now)
      upserts.push({
        ...merged,
        article_id: article.id,
        client_id: client.id,
        tom: merged.tom || 'neutro',
        impact_summary:
          merged.impact_summary ||
          (evaluation.cita_cliente
            ? `A publicação cita ${client.name} diretamente.`
            : `Cobertura monitorada de ${client.sector || client.name}.`),
      })
    }
  }

  for (let offset = 0; offset < upserts.length; offset += 500) {
    const { error } = await supabase
      .from('article_client_tags')
      .upsert(upserts.slice(offset, offset + 500), { onConflict: 'article_id,client_id' })
    if (error) throw new Error(error.message)
  }

  let removed = 0
  for (const client of clients) {
    const staleIds = articles
      .filter((article) => {
        const key = `${article.id}:${client.id}`
        const existing = current.get(key)
        return existing && existing.classification_source !== 'humano' && !matchedKeys.has(key)
      })
      .map((article) => article.id)
    if (!staleIds.length) continue
    const { error, count } = await supabase
      .from('article_client_tags')
      .delete({ count: 'exact' })
      .eq('client_id', client.id)
      .in('article_id', staleIds)
      .or('classification_source.neq.humano,classification_source.is.null')
    if (error) throw new Error(error.message)
    removed += count || 0
  }

  return { articles: articles.length, matches: upserts.length, removed }
}
