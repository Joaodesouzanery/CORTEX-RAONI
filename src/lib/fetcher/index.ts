import { fetchRSS } from './rss'
import { scrapeSite } from './scraper'
import type { FetchedArticle } from './rss'

export async function fetchFromSource(
  url: string,
  type: 'rss' | 'scrape'
): Promise<FetchedArticle[]> {
  // TI Inside blocks its feed intermittently with 403. Keep the source ID and
  // health history stable, but collect the same domain through Google News.
  if (url === 'https://tiinside.com.br/feed/') {
    return fetchRSS(
      'https://news.google.com/rss/search?q=site%3Atiinside.com.br%20%28software%20OR%20tecnologia%20OR%20tributa%C3%A7%C3%A3o%20OR%20trabalho%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'
    )
  }
  if (type === 'rss') return fetchRSS(url)
  return scrapeSite(url)
}
