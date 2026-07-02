import type { Article } from '@/types'

const PAGE = 1000

/**
 * Load every article within the last `days` by paging through the API. PostgREST
 * caps a single response at ~1000 rows (db-max-rows), and the high-volume general
 * feeds (Folha, Metrópoles, G1…) would otherwise monopolize that window and push
 * the lower-volume sector feeds out of view. Paging with `offset` loads the whole
 * period so per-client relevance runs over ALL of it — not just the newest 1000.
 *
 * `maxPages` bounds the worst case (retention is 90d); stops early once a page
 * comes back short.
 */
export async function fetchArticlesWindow(days: number, maxPages = 12): Promise<Article[]> {
  const all: Article[] = []
  for (let page = 0; page < maxPages; page++) {
    const res = await fetch(`/api/articles?days=${days}&limit=${PAGE}&offset=${page * PAGE}`)
    const data = await res.json().catch(() => [])
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE) break
    if (page === maxPages - 1) {
      // Hit the safety cap — surface it instead of silently truncating the window.
      console.warn(`[articles] paginação atingiu o teto de ${maxPages} páginas (${all.length} linhas); janela pode estar truncada.`)
    }
  }
  return all
}
