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
  // Try data-src (lazy-load) first, then src — filter tracking pixels/data URIs
  const match =
    html.match(/<img[^>]+data-src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/i) ||
    html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (!match) return null
  const src = match[1]
  if (src.includes('1x1') || src.includes('pixel') || src.endsWith('.gif') || src.startsWith('data:')) return null
  return src
}

export async function fetchRSS(feedUrl: string): Promise<FetchedArticle[]> {
  const feed = await parser.parseURL(feedUrl)
  return feed.items.map((item) => {
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
}
