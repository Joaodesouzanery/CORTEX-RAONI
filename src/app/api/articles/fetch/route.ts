import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchFromSource } from '@/lib/fetcher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cap how many sources are fetched at once so the function fits the 60s limit
// even with ~23 sources (each opening sub-connections).
const FETCH_CONCURRENCY = 6
// Upsert the most recent N per feed. Google News feeds return ~100 items; with
// the batched upsert below (one round-trip per source) 100 fits well under 60s,
// so we no longer discard most of the feed.
const MAX_PER_FEED = 100
// Drop articles older than this so the table stays bounded (runs every fetch).
const RETENTION_DAYS = 90

async function fetchWithTimeout(url: string, type: 'rss' | 'scrape', timeoutMs = 10000) {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout`)), timeoutMs)
  )
  return Promise.race([fetchFromSource(url, type), timeoutPromise])
}

async function runFetch() {
  const supabase = createClient()
  const { data: sources } = await supabase.from('sources').select('*').eq('active', true)
  if (!sources?.length) return NextResponse.json({ fetched: 0, sources: [] })

  const fetchOne = async (source: { id: string; name: string; url: string; type: 'rss' | 'scrape' }) => {
    const raw = (await fetchWithTimeout(source.url, source.type)).slice(0, MAX_PER_FEED)
    // Dedupe by URL within the feed: a single upsert statement can't touch the
    // same conflict target (url) twice ("ON CONFLICT ... cannot affect row a
    // second time"), and some feeds repeat links.
    const byUrl = new Map<string, (typeof raw)[number]>()
    for (const a of raw) if (a.url) byUrl.set(a.url, a)
    const articles = Array.from(byUrl.values()).map((a) => ({ ...a, source_id: source.id }))
    if (articles.length === 0) return { source: source.name, fetched: 0 }

    // One batched upsert per source (was one round-trip per article). This is
    // what lets us raise MAX_PER_FEED without blowing the 60s budget.
    const { error } = await supabase
      .from('articles')
      .upsert(articles, { onConflict: 'url', ignoreDuplicates: false })
    if (error) {
      // Surface the real DB error (e.g. a missing column) in the UI diagnostic
      // instead of a silent "0 artigos".
      console.error(`[fetch] upsert falhou em "${source.name}": ${error.message}`)
      return { source: source.name, fetched: 0, error: error.message }
    }
    return { source: source.name, fetched: articles.length }
  }

  // Fetch in batches to cap concurrency (total time ≈ slowest batch chain).
  const sourceResults: PromiseSettledResult<{ source: string; fetched: number; error?: string }>[] = []
  for (let i = 0; i < sources.length; i += FETCH_CONCURRENCY) {
    const batch = sources.slice(i, i + FETCH_CONCURRENCY)
    sourceResults.push(...(await Promise.allSettled(batch.map(fetchOne))))
  }

  const results = sourceResults.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    const message = r.reason?.message || 'Erro'
    // Surface per-source failures in server logs (not just the UI diagnostics).
    console.error(`[fetch] fonte "${sources[i].name}" (${sources[i].url}) falhou: ${message}`)
    return { source: sources[i].name, error: message }
  })

  // Retention: keep the table bounded. Best-effort — never fail the fetch over it.
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000).toISOString()
  const { error: retErr } = await supabase.from('articles').delete().lt('published_at', cutoff)
  if (retErr) console.error(`[fetch] retenção falhou: ${retErr.message}`)
  const { error: retErr2 } = await supabase.from('articles').delete().is('published_at', null).lt('fetched_at', cutoff)
  if (retErr2) console.error(`[fetch] retenção (sem data) falhou: ${retErr2.message}`)

  const totalFetched = results.reduce((sum, r) => sum + (('fetched' in r ? r.fetched : 0)), 0)
  return NextResponse.json({ fetched: totalFetched, sources: results })
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const body = await req.json().catch(() => ({}))
    if (!body.manual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  return runFetch()
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runFetch()
}
