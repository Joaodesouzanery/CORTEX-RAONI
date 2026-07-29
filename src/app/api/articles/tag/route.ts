import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { articleTagSchema, formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/articles/tag?client_id=…  → every tag for that client (small table;
// the curation UI merges these into the loaded articles by article_id).
export async function GET(req: Request) {
  const supabase = createClient()
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('article_client_tags')
    .select(
      'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, monitoring_status, match_score, match_reasons, rule_version, classified_at, report_role, editorial_score, editorial_reason, cluster_label, report_role_source, triaged_at, triage_version, updated_at'
    )
    .eq('client_id', clientId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/articles/tag  → upsert one (article, client) reputational reading.
// The body carries only the dimension(s) being changed; unspecified columns keep
// their stored value (partial update on conflict).
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = articleTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const { article_id, client_id, ...patch } = parsed.data
  const row: Record<string, unknown> = { article_id, client_id, updated_at: new Date().toISOString() }
  // Only forward the keys actually present in the request so a partial edit
  // (e.g. just `tom`) never blanks the other dimensions.
  for (const k of [
    'tom',
    'relevancia',
    'cita_cliente',
    'tema',
    'classification_source',
    'confidence',
    'impact_summary',
    'monitoring_status',
    'report_role',
    'editorial_score',
    'editorial_reason',
    'cluster_label',
    'report_role_source',
  ] as const) {
    if (k in patch) row[k] = patch[k]
  }
  if (!('classification_source' in patch)) row.classification_source = 'humano'
  if ('report_role' in patch) {
    row.report_role_source = 'humano'
    row.triaged_at = new Date().toISOString()
    row.triage_version = 1
  }

  const { data, error } = await supabase
    .from('article_client_tags')
    .upsert(row, { onConflict: 'article_id,client_id' })
    .select(
      'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, monitoring_status, match_score, match_reasons, rule_version, classified_at, report_role, editorial_score, editorial_reason, cluster_label, report_role_source, triaged_at, triage_version, updated_at'
    )
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
