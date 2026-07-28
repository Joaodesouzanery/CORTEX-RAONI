import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { articleTagBulkSchema, formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

type Dim = 'tom' | 'relevancia' | 'cita_cliente' | 'tema' | 'classification_source' | 'confidence' | 'impact_summary'
const DIMS: Dim[] = [
  'tom',
  'relevancia',
  'cita_cliente',
  'tema',
  'classification_source',
  'confidence',
  'impact_summary',
]

// POST /api/articles/tag/bulk → apply many (article, client) tags at once.
// FILL-ONLY: a dimension already set by the human is preserved; a suggestion
// only fills a dimension that is currently empty. Nothing the curator did is
// overwritten.
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = articleTagBulkSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { client_id, items } = parsed.data

  // Load current tags so the merge preserves whatever the human already set.
  const ids = items.map((i) => i.article_id)
  const { data: existing, error: exErr } = await supabase
    .from('article_client_tags')
    .select('article_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary')
    .eq('client_id', client_id)
    .in('article_id', ids)
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })

  const prev = new Map<string, Record<string, unknown>>()
  for (const t of existing || []) prev.set(t.article_id, t as Record<string, unknown>)

  const now = new Date().toISOString()
  const rows = items.map((item) => {
    const cur = prev.get(item.article_id) || {}
    const row: Record<string, unknown> = { article_id: item.article_id, client_id, updated_at: now }
    for (const d of DIMS) {
      // Existing non-null wins; otherwise take the suggestion (may be null).
      const existingVal = cur[d]
      row[d] = existingVal !== undefined && existingVal !== null ? existingVal : (item[d] ?? null)
    }
    return row
  })

  const { data, error } = await supabase
    .from('article_client_tags')
    .upsert(rows, { onConflict: 'article_id,client_id' })
    .select(
      'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, updated_at'
    )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
