import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities, extractFirstImage, getMediaUrl } from './rss'

describe('decodeHtmlEntities', () => {
  it('decodes named PT-BR accent entities', () => {
    expect(decodeHtmlEntities('informa&ccedil;&atilde;o')).toBe('informação')
    expect(decodeHtmlEntities('energia el&eacute;trica')).toBe('energia elétrica')
    expect(decodeHtmlEntities('voltagem &agrave; rede')).toBe('voltagem à rede')
  })

  it('decodes basic markup and quote entities', () => {
    expect(decodeHtmlEntities('a &amp; b')).toBe('a & b')
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>')
    expect(decodeHtmlEntities('&quot;aspas&quot;')).toBe('"aspas"')
    expect(decodeHtmlEntities('it&#39;s')).toBe("it's")
  })

  it('decodes numeric (decimal and hex) entities', () => {
    expect(decodeHtmlEntities('&#231;')).toBe('ç') // decimal
    expect(decodeHtmlEntities('&#xe9;')).toBe('é') // hex
  })

  it('leaves plain text untouched', () => {
    expect(decodeHtmlEntities('texto normal sem entidades')).toBe('texto normal sem entidades')
  })
})

describe('extractFirstImage', () => {
  it('returns null for empty/nullish input', () => {
    expect(extractFirstImage(null)).toBeNull()
    expect(extractFirstImage(undefined)).toBeNull()
    expect(extractFirstImage('')).toBeNull()
  })

  it('extracts a standard <img src> with a known extension', () => {
    const html = '<p>oi</p><img src="https://cdn.site.com/foto.jpg" alt="x">'
    expect(extractFirstImage(html)).toBe('https://cdn.site.com/foto.jpg')
  })

  it('prefers data-src (lazy-loaded images)', () => {
    const html = '<img data-src="https://cdn.site.com/real.png" src="https://cdn.site.com/placeholder.gif">'
    expect(extractFirstImage(html)).toBe('https://cdn.site.com/real.png')
  })

  it('rejects tracking pixels, gifs and data URIs', () => {
    expect(extractFirstImage('<img src="https://t.co/1x1.png">')).toBeNull()
    expect(extractFirstImage('<img src="https://x.com/pixel.png">')).toBeNull()
    expect(extractFirstImage('<img src="https://x.com/anim.gif">')).toBeNull()
    expect(extractFirstImage('<img src="data:image/png;base64,AAAA">')).toBeNull()
  })

  it('falls back to a generic src when no known extension is present', () => {
    const html = '<img src="https://cdn.site.com/image?id=42">'
    expect(extractFirstImage(html)).toBe('https://cdn.site.com/image?id=42')
  })
})

describe('getMediaUrl', () => {
  it('returns null for nullish input', () => {
    expect(getMediaUrl(null)).toBeNull()
    expect(getMediaUrl(undefined)).toBeNull()
  })

  it('reads url from the rss-parser $.url attribute form', () => {
    expect(getMediaUrl({ $: { url: 'https://x.com/a.jpg' } })).toBe('https://x.com/a.jpg')
  })

  it('reads url from a plain object form', () => {
    expect(getMediaUrl({ url: 'https://x.com/b.jpg' })).toBe('https://x.com/b.jpg')
  })

  it('handles the array form by taking the first item', () => {
    expect(getMediaUrl([{ $: { url: 'https://x.com/first.jpg' } }, { $: { url: 'https://x.com/second.jpg' } }])).toBe(
      'https://x.com/first.jpg'
    )
  })
})
