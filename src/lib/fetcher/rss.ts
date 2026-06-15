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

function extractFirstImage(html: string | null | undefined): string | null {
  if (!html) return null
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (!match) return null
  const src = match[1]
  // Filter out tiny tracking pixels and icons
  if (src.includes('1x1') || src.includes('pixel') || src.endsWith('.gif')) return null
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

    const excerpt = item.contentSnippet?.replace(/<[^>]+>/g, '').trim().slice(0, 300) || null

    return {
      title: item.title?.trim() || '',
      url: item.link || '',
      image_url: imageUrl,
      excerpt,
      content: contentEncoded || item.content || null,
      published_at: item.isoDate || null,
    }
  }).filter((a) => a.title && a.url)
}
