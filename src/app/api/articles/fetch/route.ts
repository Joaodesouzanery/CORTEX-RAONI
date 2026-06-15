import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchFromSource } from '@/lib/fetcher'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function runFetch() {
  const supabase = createClient()
  const { data: sources } = await supabase.from('sources').select('*').eq('active', true)
  if (!sources?.length) return NextResponse.json({ fetched: 0, sources: [] })

  let totalFetched = 0
  const results = []

  for (const source of sources) {
    try {
      const articles = await fetchFromSource(source.url, source.type)
      let count = 0
      for (const article of articles) {
        const { error } = await supabase.from('articles').upsert(
          { ...article, source_id: source.id },
          { onConflict: 'url', ignoreDuplicates: true }
        )
        if (!error) count++
      }
      totalFetched += count
      results.push({ source: source.name, fetched: count })
    } catch (err) {
      results.push({ source: source.name, error: String(err) })
    }
  }

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
