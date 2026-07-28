// Full-text extraction for the dossier flow. Google News RSS items arrive with
// only a title + a redirect link and (almost) no body, which makes for a thin
// briefing. This module resolves the real publisher URL (decoding Google News'
// token format via its batchexecute endpoint) and pulls the article's main text
// (mini-Readability), so the master prompt gets real material.
//
// Server-only (uses Buffer + cheerio). Imported by /api/reports/dossier.

import { BROWSER_USER_AGENT } from './constants'

const GN_HOST = 'news.google.'

function isGoogleNews(link: string): boolean {
  try {
    return new URL(link).hostname.includes(GN_HOST)
  } catch {
    return false
  }
}

function googleNewsId(link: string): string | null {
  try {
    return new URL(link).pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

/**
 * Fast path: some (older-format) Google News links carry the real URL as an
 * ASCII substring inside the base64 path — decode without a network call.
 * Returns null for the newer token format (caller falls back to batchexecute).
 */
export function decodeGoogleNewsUrl(link: string): string | null {
  const id = isGoogleNews(link) ? googleNewsId(link) : null
  if (!id || id.length < 20) return null
  try {
    const decoded = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary')
    const m = decoded.match(/https?:\/\/[^\s\x00-\x1f"'<>\\]+/)
    if (!m) return null
    const url = m[0]
    if (/(^|\/\/)([^/]*\.)?google\./.test(url)) return null
    return url
  } catch {
    return null
  }
}

// Grab the per-article signature + timestamp Google News needs to hand back the
// real URL. Read them straight from the page HTML (robust across layouts).
async function getGoogleNewsParams(
  id: string,
  timeoutMs: number
): Promise<{ id: string; sig: string; ts: string } | null> {
  try {
    const res = await fetch(`https://news.google.com/rss/articles/${id}`, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const html = await res.text()
    const sig = html.match(/data-n-a-sg="([^"]+)"/)?.[1]
    const ts = html.match(/data-n-a-ts="([^"]+)"/)?.[1]
    return sig && ts ? { id, sig, ts } : null
  } catch {
    return null
  }
}

// Ask Google News' batchexecute endpoint to translate the token into the real
// publisher URL.
async function batchDecode(
  params: { id: string; sig: string; ts: string },
  timeoutMs: number
): Promise<string | null> {
  try {
    const inner = [
      'garturlreq',
      [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
      params.id,
      Number(params.ts),
      params.sig,
    ]
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', JSON.stringify(inner)]]]))
    const res = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const text = await res.text()
    for (const line of text.split('\n')) {
      if (line.includes('wrb.fr') && line.includes('garturlres')) {
        try {
          return JSON.parse(JSON.parse(line)[0][2])[1] || null
        } catch {
          return null
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** Resolve a Google News link to the real article URL (fast path, then API). */
export async function resolveGoogleNewsUrl(link: string, timeoutMs = 5000): Promise<string | null> {
  const fast = decodeGoogleNewsUrl(link)
  if (fast) return fast
  const id = googleNewsId(link)
  if (!id) return null
  const params = await getGoogleNewsParams(id, timeoutMs)
  return params ? batchDecode(params, timeoutMs) : null
}

/**
 * Mini-Readability: strip boilerplate, prefer <article> or the densest
 * paragraph container, and join the paragraph text. Returns null if nothing
 * substantial is found.
 */
async function extractMainText(html: string): Promise<string | null> {
  const { load } = await import('cheerio')
  const $ = load(html)
  $('script,style,noscript,nav,header,footer,aside,form,figure,figcaption,iframe,svg').remove()

  let root = $('article').first()
  if (!root.length || root.text().trim().length < 400) {
    let best: typeof root | null = null
    let bestLen = 0
    $('div,section,main').each((_, el) => {
      const ps = $(el).find('p')
      if (ps.length < 3) return
      const len = ps.text().replace(/\s+/g, ' ').trim().length
      if (len > bestLen) {
        bestLen = len
        best = $(el)
      }
    })
    if (best) root = best
  }

  const container = root.length ? root : $('body')
  const paras: string[] = []
  container.find('p').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim()
    if (t.length >= 40) paras.push(t)
  })

  let text = paras.join('\n\n').trim()
  if (text.length < 200) {
    text = $('body').text().replace(/\s+/g, ' ').trim()
  }
  return text ? text.slice(0, 8000) : null
}

/**
 * Resolve an article link (decoding Google News when needed) and return its main
 * text. Google News items that can't be resolved return null so the caller keeps
 * the title/excerpt instead of garbage. Bounded by `timeoutMs` per fetch.
 */
export async function fetchArticleText(link: string, timeoutMs = 7000): Promise<string | null> {
  if (!link) return null
  let target = link
  if (isGoogleNews(link)) {
    const real = await resolveGoogleNewsUrl(link, Math.min(timeoutMs, 5000))
    if (!real) return null
    target = real
  }
  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': BROWSER_USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    // Guard against binary (images/PDF): only parse real HTML, never return
    // garbage extracted from non-text bytes.
    if (!/html/i.test(res.headers.get('content-type') || '')) return null
    return await extractMainText(await res.text())
  } catch {
    return null
  }
}
