import * as cheerio from 'cheerio'
import type { FetchedArticle } from './rss'
import { BROWSER_USER_AGENT, FETCH_TIMEOUTS } from './constants'
import { readCappedText, safeFetch } from '@/lib/safe-fetch'

export async function scrapeOpenGraph(pageUrl: string): Promise<FetchedArticle | null> {
  try {
    const res = await safeFetch(pageUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeoutMs: FETCH_TIMEOUTS.scrapePage,
    })
    // Antes o status nunca era conferido: uma página de manutenção 503 virava
    // HTML sem og:tags e o run era registrado como sucesso com 0 itens.
    if (!res.ok) return null
    const html = await readCappedText(res)
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
    const res = await safeFetch(siteUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      timeoutMs: FETCH_TIMEOUTS.scrapeSite,
    })
    if (!res.ok) return []
    const html = await readCappedText(res)
    const $ = cheerio.load(html)

    const articleLinks: string[] = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      let full: string
      try {
        full = href.startsWith('http') ? new URL(href).href : new URL(href, siteUrl).href
      } catch {
        return
      }
      // Comparar por HOST, não por prefixo de string: com prefixo,
      // siteUrl "http://exemplo.com" casava "http://exemplo.com.interno/".
      let sameHost = false
      try {
        sameHost = new URL(full).host === new URL(siteUrl).host
      } catch {
        sameHost = false
      }
      if (sameHost && full !== siteUrl && !articleLinks.includes(full)) {
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
