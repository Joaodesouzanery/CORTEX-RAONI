import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const sourceId = searchParams.get('source_id')
  const search = searchParams.get('search')
  const limit = parseInt(searchParams.get('limit') || '100')

  let query = supabase
    .from('articles')
    .select('*, sources(name)')
    .order('published_at', { ascending: false })
    .limit(limit)

  if (sourceId) query = query.eq('source_id', sourceId)
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
