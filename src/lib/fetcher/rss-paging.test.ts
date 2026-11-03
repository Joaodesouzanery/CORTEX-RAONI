import { afterEach, describe, expect, it, vi } from 'vitest'

const item = (n: number) => `<item><title>Matéria ${n}</title><link>https://ex.com/p/${n}</link><pubDate>Mon, 20 Oct 2026 10:00:00 GMT</pubDate></item>`
const feed = (items: number[]) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><generator>https://wordpress.org/?v=6</generator>${items.map(item).join('')}</channel></rss>`

const fetchMock = vi.fn()
vi.mock('@/lib/safe-fetch', () => ({
  safeFetch: (url: string) => fetchMock(url),
  readCappedText: async (res: Response) => res.text(),
}))

afterEach(() => fetchMock.mockReset())

const respond = (body: string) => new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } })

describe('fetchRSS com paginação WordPress', () => {
  it('busca páginas seguintes enquanto vierem itens novos', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (!url.includes('paged')) return respond(feed([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
      if (url.includes('paged=2')) return respond(feed([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]))
      return respond(feed([20, 21]))
    })
    const { fetchRSS } = await import('./rss')
    const articles = await fetchRSS('https://ex.com/feed')
    expect(articles).toHaveLength(21)
    expect(new Set(articles.map((a) => a.url)).size).toBe(21)
  })

  it('não pagina feed curto nem Google News', async () => {
    fetchMock.mockImplementation(async () => respond(feed([1, 2, 3])))
    const { fetchRSS } = await import('./rss')
    await fetchRSS('https://ex.com/feed')
    // As demais chamadas são o og:image de cada matéria, não páginas do feed.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/feed')).length).toBe(1)
  })

  it('mantém a primeira página se a segunda falhar', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('paged')) return new Response('', { status: 406 })
      return respond(feed([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    })
    const { fetchRSS } = await import('./rss')
    expect(await fetchRSS('https://ex.com/feed')).toHaveLength(10)
  })
})
