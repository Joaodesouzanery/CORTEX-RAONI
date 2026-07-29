import * as cheerio from 'cheerio'
import type { FetchedArticle } from './rss'
import { BROWSER_USER_AGENT, FETCH_TIMEOUTS } from './constants'

export async function scrapeOpenGraph(pageUrl: string): Promise<FetchedArticle | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.scrapePage),
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    const get = (prop: string) =>
      $(`meta[property="${prop}"]`).attr('content') ||
      $(`meta[name="${prop}"]`).attr('content') ||
      null

    return {
      title: get('og:title') || $('title').text() || '',
      url: pageUrl,
      image_url: get('og:image'),
      excerpt: get('og:description'),
      content: null,
      published_at: get('article:published_time'),
      publisher: get('og:site_name'),
    }
  } catch {
    return null
  }
}

export async function scrapeSite(siteUrl: string): Promise<FetchedArticle[]> {
  try {
    const res = await fetch(siteUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.scrapeSite),
    })
    const html = await res.text()
    const $ = cheerio.load(html)

    const articleLinks: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      const full = href.startsWith('http') ? href : new URL(href, siteUrl).href
      if (full.startsWith(siteUrl) && full !== siteUrl && !articleLinks.includes(full)) {
        articleLinks.push(full)
      }
    })

    const candidates = await Promise.all(
      articleLinks.slice(0, 12).map((link) => scrapeOpenGraph(link))
    )
    return candidates.filter(
      (article): article is FetchedArticle => Boolean(article?.title)
    )
  } catch {
    return []
  }
}
