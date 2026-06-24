import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('source_id')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '500')

  // List view never reads `content` (full HTML). Excluding it keeps the payload
  // small — the report flow re-fetches content by id in /api/reports.
  let query = supabase
    .from('articles')
    .select('id, source_id, title, url, image_url, excerpt, published_at, fetched_at, sources(name)')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (sourceId) query = query.eq('source_id', sourceId)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
