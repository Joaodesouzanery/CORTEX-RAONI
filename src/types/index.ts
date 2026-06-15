export interface Source {
  id: string
  name: string
  url: string
  type: 'rss' | 'scrape'
  active: boolean
  created_at: string
}

export interface Article {
  id: string
  source_id: string
  title: string
  url: string
  image_url: string | null
  excerpt: string | null
  content: string | null
  published_at: string | null
  fetched_at: string
  sources?: { name: string }
}

export interface Report {
  id: string
  prompt: string
  article_ids: string[]
  content: string
  created_at: string
}
