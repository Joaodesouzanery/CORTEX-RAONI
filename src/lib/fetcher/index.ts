import { fetchRSS } from './rss'
import { scrapeSite } from './scraper'
import type { FetchedArticle } from './rss'

export async function fetchFromSource(
  url: string,
  type: 'rss' | 'scrape'
): Promise<FetchedArticle[]> {
  if (type === 'rss') return fetchRSS(url)
  return scrapeSite(url)
}
