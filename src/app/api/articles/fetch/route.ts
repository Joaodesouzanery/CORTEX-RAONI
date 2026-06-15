import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchFromSource } from '@/lib/fetcher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  // Fetch all sources in parallel — total time = slowest source, not sum of all
  const sourceResults = await Promise.allSettled(
    sources.map(async (source) => {
      const articles = await fetchWithTimeout(source.url, source.type)
      const upserts = await Promise.allSettled(
        articles.map((article) =>
          supabase.from('articles').upsert(
            { ...article, source_id: source.id },
            { onConflict: 'url', ignoreDuplicates: false }
          )
        )
      )
      const count = upserts.filter((r) => r.status === 'fulfilled').length
      return { source: source.name, fetched: count }
    })
  )

  const results = sourceResults.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: sources[i].name, error: r.reason?.message || 'Erro' }
  )

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
