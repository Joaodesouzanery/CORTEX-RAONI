import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('source_id')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '500')
  const offsetParam = searchParams.get('offset')
  const daysParam = searchParams.get('days')
  const publishedAfter = searchParams.get('published_after')

  // List view never reads `content` (full HTML). Excluding it keeps the payload
  // small — the report flow re-fetches content by id in /api/reports.
  // nullsFirst:false so undated articles (some feeds omit dates) sink to the
  // bottom instead of burying the most recent news under the row limit.
  let query = supabase
    .from('articles')
    .select('id, source_id, title, url, image_url, excerpt, published_at, fetched_at, publisher, sources(name)')
    .order('published_at', { ascending: false, nullsFirst: false })

  if (sourceId) query = query.eq('source_id', sourceId)
  if (search) query = query.ilike('title', `%${search}%`)

  // Optional period window: bounds the payload to the retained window so the row
  // limit doesn't bury older-but-in-period news. Undated articles are kept (some
  // feeds omit dates) so the "Todos" view still shows them.
  let cutoff: string | null = null
  if (daysParam) {
    const days = parseInt(daysParam)
    if (Number.isFinite(days) && days > 0) cutoff = new Date(Date.now() - days * 86400000).toISOString()
  } else if (publishedAfter) {
    cutoff = publishedAfter
  }
  if (cutoff) {
    // Strip milliseconds: PostgREST .or() parses each branch as field.op.value on
    // dots, so an internal "." (the ".000Z") would corrupt the value.
    const safe = cutoff.replace(/\.\d{3}Z$/, 'Z')
    query = query.or(`published_at.gte.${safe},published_at.is.null`)
  }

  // Pagination: PostgREST caps a response at ~1000 rows (db-max-rows), so the
  // clients page through with `offset` (via .range) to load a full period window
  // instead of only the 1000 most-recent rows. Without offset, keep .limit.
  const offset = offsetParam ? parseInt(offsetParam) : NaN
  query = Number.isFinite(offset) && offset >= 0 ? query.range(offset, offset + limit - 1) : query.limit(limit)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return raw (no title-dedup here). Dedup is applied client-side only in the
  // general/portfolio view, so filtering by a specific source shows all of it.
  return NextResponse.json(data)
}
