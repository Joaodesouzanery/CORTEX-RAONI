import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchOgImage } from '@/lib/fetcher/rss'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Fill images for articles that have none — including Google News items, whose
// redirect links are resolved to the real outlet page (skipped in the main fetch
// for speed). Decoupled from /api/articles/fetch so the news fetch stays fast;
// this runs on its own and fills images over successive runs.
const BATCH = 8
const LIMIT = 48

async function run() {
  const supabase = createClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('id, url')
    .is('image_url', null)
    .not('url', 'is', null)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT)

  if (!articles?.length) return NextResponse.json({ updated: 0, remaining: 0 })

  let updated = 0
  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (a) => {
        const img = await fetchOgImage(a.url!)
        if (img) {
          const { error } = await supabase.from('articles').update({ image_url: img }).eq('id', a.id)
          if (!error) updated++
        }
      })
    )
  }

  const { count } = await supabase.from('articles').select('id', { count: 'exact', head: true }).is('image_url', null)

  return NextResponse.json({ updated, processed: articles.length, remaining: count ?? null })
}

export async function POST() {
  return run()
}

export async function GET() {
  return run()
}
