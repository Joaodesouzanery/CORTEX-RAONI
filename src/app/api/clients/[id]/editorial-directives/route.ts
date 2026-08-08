import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { syncDraftEditorialSnapshot } from '@/lib/editorial-directives'
import type { DirectiveCategory, DirectiveScope, DirectiveSeverity, MetricVisibility } from '@/types'

export const dynamic = 'force-dynamic'

const CATEGORIES: DirectiveCategory[] = ['captacao', 'qualificacao', 'narrativa', 'terminologia', 'metrica', 'estrutura', 'visual']
const SEVERITIES: DirectiveSeverity[] = ['block', 'warn', 'prefer']
const SCOPES: DirectiveScope[] = ['permanent', 'monthly']
const VISIBILITIES: MetricVisibility[] = ['publica', 'interna', 'omitida']

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

async function refreshOpenDrafts(supabase: ReturnType<typeof createClient>, clientId: string) {
  const { data: drafts } = await supabase
    .from('monthly_report_drafts')
    .select('*')
    .eq('client_id', clientId)
    .neq('status', 'approved')
  for (const draft of drafts || []) await syncDraftEditorialSnapshot(supabase, draft)
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const period = new URL(req.url).searchParams.get('period')
  const supabase = createClient()
  let query = supabase
    .from('client_editorial_directives')
    .select('*')
    .eq('client_id', id)
    .order('category')
    .order('title')
  if (period) query = query.or(`scope.eq.permanent,period_month.eq.${period.slice(0, 7)}-01`)
  const [{ data, error }, { data: feedback }] = await Promise.all([
    query,
    supabase
      .from('report_client_feedback')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ directives: data || [], feedback: feedback || [] })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !CATEGORIES.includes(body.category) || !SEVERITIES.includes(body.severity || 'prefer') || !SCOPES.includes(body.scope || 'permanent')) {
    return NextResponse.json({ error: 'Diretiva editorial inválida.' }, { status: 400 })
  }
  const title = String(body.title || '').trim().slice(0, 300)
  const instruction = String(body.instruction || '').trim().slice(0, 10_000)
  const scope = (body.scope || 'permanent') as DirectiveScope
  const periodMonth = scope === 'monthly' ? `${String(body.period_month || '').slice(0, 7)}-01` : null
  if (!title || !instruction || (scope === 'monthly' && !/^\d{4}-\d{2}-01$/.test(periodMonth || ''))) {
    return NextResponse.json({ error: 'Título, instrução e competência mensal válida são obrigatórios.' }, { status: 400 })
  }
  const metricVisibility = body.metric_visibility && VISIBILITIES.includes(body.metric_visibility)
    ? body.metric_visibility
    : null
  const directiveKey = slug(String(body.directive_key || title))
  const row = {
    client_id: id,
    directive_key: directiveKey,
    category: body.category,
    title,
    instruction,
    rationale: String(body.rationale || '').slice(0, 5000),
    severity: body.severity || 'prefer',
    scope,
    period_month: periodMonth,
    source: ['cliente', 'operador', 'relatorio_aprovado', 'curado'].includes(body.source) ? body.source : 'operador',
    phrase: body.phrase ? String(body.phrase).trim().slice(0, 500) : null,
    replacements: Array.isArray(body.replacements) ? body.replacements.map(String).filter(Boolean).slice(0, 20) : [],
    metric_visibility: metricVisibility,
    allow_literal_quote: body.allow_literal_quote === true,
    examples: body.examples && typeof body.examples === 'object' ? body.examples : {},
    active: body.active !== false,
    updated_at: new Date().toISOString(),
  }
  const supabase = createClient()
  let existingQuery = supabase
    .from('client_editorial_directives')
    .select('id, version')
    .eq('client_id', id)
    .eq('directive_key', directiveKey)
    .eq('scope', scope)
  existingQuery = periodMonth ? existingQuery.eq('period_month', periodMonth) : existingQuery.is('period_month', null)
  const { data: existing } = await existingQuery.maybeSingle()
  const result = existing
    ? await supabase.from('client_editorial_directives').update({ ...row, version: Number(existing.version || 0) + 1 }).eq('id', existing.id).select().single()
    : await supabase.from('client_editorial_directives').insert(row).select().single()
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  await refreshOpenDrafts(supabase, id)
  return NextResponse.json(result.data, { status: existing ? 200 : 201 })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body?.directive_id) return NextResponse.json({ error: 'Diretiva não informada.' }, { status: 400 })
  const supabase = createClient()
  const { error } = await supabase
    .from('client_editorial_directives')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', body.directive_id)
    .eq('client_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await refreshOpenDrafts(supabase, id)
  return NextResponse.json({ ok: true })
}
