import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { classifyArticleBatch } from '@/lib/classification'
import { monthBounds } from '@/lib/report-drafts'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 500

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))
  const cursor = typeof body?.cursor === 'string' && body.cursor ? body.cursor : null
  // O workflow sempre mandou `period`, mas a rota ignorava: "reclassificar
  // 2026-10" varria o acervo inteiro e apagava etiquetas automáticas de todos
  // os meses (classification.ts remove o que deixou de casar). Agora o mês
  // limita a varredura e, com ela, a remoção.
  const rawPeriod = body?.period
  if (rawPeriod !== undefined && rawPeriod !== null && (typeof rawPeriod !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(rawPeriod))) {
    return NextResponse.json({ error: 'Período inválido; use YYYY-MM.' }, { status: 400 })
  }
  const period = typeof rawPeriod === 'string' ? rawPeriod : null
  let query = supabase
    .from('articles')
    .select('*, sources(name, categoria, is_general)')
    .order('id', { ascending: true })
    .limit(BATCH)
  if (cursor) query = query.gt('id', cursor)
  if (period) {
    const bounds = monthBounds(period)
    query = query.gte('published_at', bounds.start).lt('published_at', bounds.end)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const articles = (data as unknown as Article[]) || []
  const result = await classifyArticleBatch(supabase, articles)
  const done = articles.length < BATCH
  return NextResponse.json({
    ...result,
    period,
    done,
    next_cursor: done ? null : articles.at(-1)?.id || null,
  })
}
