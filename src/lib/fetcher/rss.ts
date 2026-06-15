import Parser from 'rss-parser'

const parser = new Parser({
  customFields: {
    item: ['media:content', 'media:thumbnail', 'enclosure'],
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

export async function fetchRSS(feedUrl: string): Promise<FetchedArticle[]> {
  const feed = await parser.parseURL(feedUrl)
  return feed.items.map((item) => {
    const imageUrl =
      (item as any)['media:content']?.$.url ||
      (item as any)['media:thumbnail']?.$.url ||
      item.enclosure?.url ||
      null

    return {
      title: item.title || '',
      url: item.link || '',
      image_url: imageUrl,
      excerpt: item.contentSnippet?.slice(0, 300) || null,
      content: item.content || null,
      published_at: item.isoDate || null,
    }
  }).filter((a) => a.title && a.url)
}
