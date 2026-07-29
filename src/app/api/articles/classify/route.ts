import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { classifyArticleBatch } from '@/lib/classification'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 500

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))
  const cursor = typeof body?.cursor === 'string' && body.cursor ? body.cursor : null
  let query = supabase
    .from('articles')
    .select('*, sources(name, categoria, is_general)')
    .order('id', { ascending: true })
    .limit(BATCH)
  if (cursor) query = query.gt('id', cursor)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const articles = (data as unknown as Article[]) || []
  const result = await classifyArticleBatch(supabase, articles)
  const done = articles.length < BATCH
  return NextResponse.json({
    ...result,
    done,
    next_cursor: done ? null : articles.at(-1)?.id || null,
  })
}
