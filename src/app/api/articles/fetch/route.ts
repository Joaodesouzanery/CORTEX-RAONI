import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchFromSource } from '@/lib/fetcher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cap how many sources are fetched at once so the function fits the 60s limit
// even with ~23 sources (each opening sub-connections).
const FETCH_CONCURRENCY = 6
// Only upsert the most recent N per feed (Google News returns 50-100) to bound
// the work per run and stay under the 60s limit.
const MAX_PER_FEED = 40
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
    const articles = (await fetchWithTimeout(source.url, source.type)).slice(0, MAX_PER_FEED)
    const upserts = await Promise.allSettled(
      articles.map((article) =>
        supabase.from('articles').upsert(
          { ...article, source_id: source.id },
          { onConflict: 'url', ignoreDuplicates: false }
        )
      )
    )
    // Count only upserts that resolved without a Supabase error.
    const count = upserts.filter((r) => r.status === 'fulfilled' && !r.value?.error).length
    // Surface the real DB error when nothing was written (e.g. a missing column),
    // so the UI diagnostic shows the cause instead of a silent "0 artigos".
    let dbError: string | undefined
    if (count === 0 && articles.length > 0) {
      const firstFailed = upserts.find((r) => r.status === 'fulfilled' && r.value?.error)
      dbError =
        (firstFailed && firstFailed.status === 'fulfilled' ? firstFailed.value.error?.message : undefined) ||
        (upserts.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined)?.reason?.message
      if (dbError) console.error(`[fetch] upsert falhou em "${source.name}": ${dbError}`)
    }
    return { source: source.name, fetched: count, ...(dbError ? { error: dbError } : {}) }
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
