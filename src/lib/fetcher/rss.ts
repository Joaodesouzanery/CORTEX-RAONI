import Parser from 'rss-parser'
import { BROWSER_USER_AGENT, FETCH_TIMEOUTS } from './constants'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      // Some feeds (Folha, Poder360) embed HTML with images in <description>
      ['description', 'rawDescription'],
      // Google News exposes the real outlet in <source>
      ['source', 'sourceTag'],
    ],
  },
})

export interface FetchedArticle {
  title: string
  url: string
  image_url: string | null
  excerpt: string | null
  content: string | null
  published_at: string | null
  publisher: string | null
}

// Google News titles are "Headline - Outlet"; the outlet is also in <source>.
// Returns the real outlet name (or null) for cleaner citations.
export function getPublisher(item: any): string | null {
  const src = item?.sourceTag
  const name = (typeof src === 'string' ? src : src?._ || src?.name)?.trim()
  return name || null
}

// Strip a trailing " - Outlet" suffix that Google News appends to titles.
export function stripPublisherSuffix(title: string, publisher: string | null): string {
  if (!publisher) return title
  const suffix = ` - ${publisher}`
  return title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title
}

// Fetch RSS as raw bytes, detect charset from XML declaration, decode correctly,
// then replace the encoding declaration so xml2js doesn't attempt to re-decode.
async function fetchFeedString(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': BROWSER_USER_AGENT,
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = await res.arrayBuffer()
  // Sniff first 300 bytes (UTF-8 safe for ASCII XML declaration)
  const sniff = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer).slice(0, 300))
  const charsetMatch = sniff.match(/encoding=["']([^"']+)["']/i)
  const charset = charsetMatch?.[1]?.toLowerCase() || 'utf-8'
  const decoded = new TextDecoder(charset, { fatal: false }).decode(buffer)
  // Replace encoding declaration to prevent xml2js from re-interpreting the string
  return decoded.replace(/(<\?xml[^?>]*?)encoding=["'][^"']*["']/i, '$1encoding="utf-8"')
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&ccedil;/g, 'ç').replace(/&Ccedil;/g, 'Ç')
    .replace(/&atilde;/g, 'ã').replace(/&Atilde;/g, 'Ã')
    .replace(/&otilde;/g, 'õ').replace(/&Otilde;/g, 'Õ')
    .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
    .replace(/&agrave;/g, 'à').replace(/&egrave;/g, 'è')
    .replace(/&uuml;/g, 'ü').replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

export function extractFirstImage(html: string | null | undefined): string | null {
  if (!html) return null
  const match =
    html.match(/<img[^>]+data-src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (!match) return null
  const src = match[1]
  if (src.includes('1x1') || src.includes('pixel') || src.endsWith('.gif') || src.startsWith('data:')) return null
  return src
}

// Handles both single-object and array forms of media:content / media:thumbnail
export function getMediaUrl(field: any): string | null {
  if (!field) return null
  const item = Array.isArray(field) ? field[0] : field
  return item?.$?.url || item?.url || item?._ || null
}

// Fetch the article page and extract its lead image. Follows redirects (so it
// works for Google News redirect links, landing on the real publisher page) and
// tries several metadata tags before falling back to the first in-content image.
export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUTS.ogImage),
    })
    if (!res.ok) return null
    const finalUrl = res.url || articleUrl // after any redirects (Google News → outlet)
    const html = await res.text()
    const { load } = await import('cheerio')
    const $ = load(html)

    const candidate =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:url"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('link[rel="image_src"]').attr('href') ||
      $('meta[itemprop="image"]').attr('content') ||
      extractFirstImage($.html()) ||
      null
    if (!candidate) return null

    let img = candidate.trim()
    if (img.startsWith('//')) img = 'https:' + img
    if (img.startsWith('http')) return img
    try {
      return new URL(img, finalUrl).href
    } catch {
      return null
    }
  } catch {
    return null
  }
}

export async function fetchRSS(feedUrl: string): Promise<FetchedArticle[]> {
  const xml = await fetchFeedString(feedUrl)
  const feed = await parser.parseString(xml)

  const articles: FetchedArticle[] = feed.items.map((item) => {
    const mediaContent = (item as any)['media:content']
    const mediaThumbnail = (item as any)['media:thumbnail']
    const contentEncoded = (item as any)['content:encoded'] as string | undefined
    const rawDescription = (item as any)['rawDescription'] as string | undefined

    const imageUrl =
      getMediaUrl(mediaContent) ||
      getMediaUrl(mediaThumbnail) ||
      item.enclosure?.url ||
      extractFirstImage(contentEncoded) ||
      extractFirstImage(rawDescription) ||
      extractFirstImage(item.content) ||
      null

    const rawExcerpt = item.contentSnippet?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || null
    const excerpt = rawExcerpt ? decodeHtmlEntities(rawExcerpt) : null

    const publisher = getPublisher(item)
    const title = stripPublisherSuffix(decodeHtmlEntities(item.title?.trim() || ''), publisher)

    return {
      title,
      url: item.link || '',
      image_url: imageUrl,
      excerpt,
      content: contentEncoded || item.content || null,
      published_at: item.isoDate || null,
      publisher,
    }
  }).filter((a) => a.title?.trim() && a.url?.trim())

  // OG image fallback for articles without any image from RSS (up to 30 per feed).
  // Skip Google News items: their links are redirects, so OG fetching is useless
  // and just adds latency.
  const isGoogleNews = feedUrl.includes('news.google.com')
  if (!isGoogleNews) {
    const missing = articles.filter((a) => !a.image_url)
    if (missing.length > 0) {
      await Promise.allSettled(
        missing.slice(0, 30).map(async (a) => {
          a.image_url = await fetchOgImage(a.url)
        })
      )
    }
  }

  return articles
}
