import * as cheerio from 'cheerio'
import type { FetchedArticle } from './rss'
import { BROWSER_USER_AGENT, FETCH_TIMEOUTS } from './constants'
import { readCappedText, safeFetch } from '@/lib/safe-fetch'
import { pickImageCandidate } from './article-image'
import { rankArticleLinks } from './article-links'

/**
 * Páginas baixadas por fonte `scrape` em cada execução.
 *
 * Continua 12 porque o orçamento é compartilhado: `processFetchSource` dá 25 s
 * para a fonte inteira (src/lib/fetch-run.ts) e cada página tem timeout de 10 s
 * (FETCH_TIMEOUTS.scrapePage). O ganho de cobertura desta rodada veio de gastar
 * melhor as 12 — ordenando por probabilidade de ser matéria — e não de subir o
 * teto, que esbarraria no tempo antes de render item.
 */
const SCRAPE_PAGE_LIMIT = 12

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
      // Fonte `scrape` aponta para páginas institucionais (gov.br, sindicatos),
      // onde og:image é o brasão/logo — não a foto da matéria.
      image_url: pickImageCandidate([get('og:image'), get('twitter:image')], res.url || pageUrl),
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

    // Ordena ANTES de cortar. Em ordem do DOM, os 12 primeiros links de um site
    // de notícias são o menu — a fonte gastava as 12 requisições em "Home",
    // "Sobre" e "Categorias" e entregava duas ou três matérias, porque
    // `isNavigationPage` só descarta DEPOIS de baixar.
    const candidates = await Promise.all(
      rankArticleLinks(articleLinks, siteUrl)
        .slice(0, SCRAPE_PAGE_LIMIT)
        .map((link) => scrapeOpenGraph(link))
    )
    return candidates.filter(
      (article): article is FetchedArticle => Boolean(article?.title)
    )
  } catch {
    return []
  }
}
