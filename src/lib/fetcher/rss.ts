import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
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
}

// Fetch RSS feed as raw bytes, detect charset from XML declaration, decode correctly.
// This fixes ISO-8859-1 feeds (Folha, etc.) that parseURL() misinterprets as UTF-8.
async function fetchFeedString(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
  })
  const buffer = await res.arrayBuffer()
  // Sniff the first 200 bytes as UTF-8 to read the XML declaration charset
  const sniff = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer).slice(0, 200))
  const charsetMatch = sniff.match(/encoding=["']([^"']+)["']/i)
  const charset = charsetMatch?.[1] || 'utf-8'
  return new TextDecoder(charset, { fatal: false }).decode(buffer)
}

function decodeHtmlEntities(text: string): string {
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

function extractFirstImage(html: string | null | undefined): string | null {
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

async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
      signal: AbortSignal.timeout(5000),
    })
    const html = await res.text()
    const { load } = await import('cheerio')
    const $ = load(html)
    return (
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      null
    )
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

    const imageUrl =
      mediaContent?.$.url ||
      mediaContent?.url ||
      mediaThumbnail?.$.url ||
      mediaThumbnail?.url ||
      item.enclosure?.url ||
      extractFirstImage(contentEncoded) ||
      extractFirstImage(item.content) ||
      null

    const rawExcerpt = item.contentSnippet?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || null
    const excerpt = rawExcerpt ? decodeHtmlEntities(rawExcerpt) : null

    return {
      title: decodeHtmlEntities(item.title?.trim() || ''),
      url: item.link || '',
      image_url: imageUrl,
      excerpt,
      content: contentEncoded || item.content || null,
      published_at: item.isoDate || null,
    }
  }).filter((a) => a.title && a.url)

  // Fetch OG images for articles that have none (limit to 5 parallel requests per feed)
  const missing = articles.filter((a) => !a.image_url)
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.slice(0, 5).map(async (a) => {
        a.image_url = await fetchOgImage(a.url)
      })
    )
  }

  return articles
}
