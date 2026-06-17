import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      ['content:encoded', 'content:encoded'],
      // Some feeds (Folha, Poder360) embed HTML with images in <description>
      ['description', 'rawDescription'],
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

// Fetch RSS as raw bytes, detect charset from XML declaration, decode correctly,
// then replace the encoding declaration so xml2js doesn't attempt to re-decode.
async function fetchFeedString(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)',
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

// Handles both single-object and array forms of media:content / media:thumbnail
function getMediaUrl(field: any): string | null {
  if (!field) return null
  const item = Array.isArray(field) ? field[0] : field
  return item?.$?.url || item?.url || item?._ || null
}

async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const res = await fetch(articleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const { load } = await import('cheerio')
    const $ = load(html)
    const og =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content')
    if (!og) return null
    if (og.startsWith('http')) return og
    // Resolve relative URLs
    const base = new URL(articleUrl)
    return new URL(og, base.origin).href
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

    return {
      title: decodeHtmlEntities(item.title?.trim() || ''),
      url: item.link || '',
      image_url: imageUrl,
      excerpt,
      content: contentEncoded || item.content || null,
      published_at: item.isoDate || null,
    }
  }).filter((a) => a.title && a.url)

  // OG image fallback for articles without any image from RSS (up to 10 per feed)
  const missing = articles.filter((a) => !a.image_url)
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.slice(0, 15).map(async (a) => {
        a.image_url = await fetchOgImage(a.url)
      })
    )
  }

  return articles
}
