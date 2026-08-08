import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { syncDraftEditorialSnapshot } from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['captacao', 'qualificacao', 'narrativa', 'terminologia', 'metrica', 'estrutura', 'visual']

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('client_id').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  const [{ data, error }, { data: revisions }] = await Promise.all([
    supabase
      .from('report_client_feedback')
      .select('*, client_editorial_directives(*)')
      .eq('draft_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('report_section_revisions')
      .select('section_key, version, origin, content, created_at')
      .eq('draft_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const suggestions = Array.from({ length: 9 }, (_, index) => index + 1).flatMap((section) => {
    const rows = (revisions || []).filter((row) => row.section_key === section)
    const human = rows.find((row) => row.origin === 'humano')
    const generated = rows.find((row) => row.origin === 'ia' && (!human || row.created_at < human.created_at))
    if (!human || !generated || human.content === generated.content) return []
    return [{
      section_key: section,
      before_text: generated.content,
      after_text: human.content,
      changed_characters: Math.abs(human.content.length - generated.content.length),
    }]
  })
  return NextResponse.json({ feedback: data || [], suggestions })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !CATEGORIES.includes(body.category) || !String(body.feedback || '').trim()) {
    return NextResponse.json({ error: 'Feedback e categoria são obrigatórios.' }, { status: 400 })
  }
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('*').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  const feedbackText = String(body.feedback).trim().slice(0, 10_000)
  const { data: feedback, error } = await supabase
    .from('report_client_feedback')
    .insert({
      client_id: draft.client_id,
      draft_id: id,
      report_id: body.report_id || null,
      reference_report_id: body.reference_report_id || null,
      category: body.category,
      feedback: feedbackText,
      before_text: body.before_text ? String(body.before_text).slice(0, 10_000) : null,
      after_text: body.after_text ? String(body.after_text).slice(0, 10_000) : null,
      status: body.promote ? 'applied' : 'pending',
      promoted: body.promote === true,
      resolved_at: body.promote ? new Date().toISOString() : null,
    })
    .select()
    .single()
  if (error || !feedback) return NextResponse.json({ error: error?.message || 'Falha ao registrar feedback.' }, { status: 500 })

  let directive = null
  if (body.promote) {
    const title = String(body.title || feedbackText.slice(0, 90)).trim()
    const directiveKey = slug(String(body.directive_key || title))
    const { data: existing } = await supabase
      .from('client_editorial_directives')
      .select('id, version')
      .eq('client_id', draft.client_id)
      .eq('directive_key', directiveKey)
      .eq('scope', 'permanent')
      .maybeSingle()
    const row = {
      client_id: draft.client_id,
      directive_key: directiveKey,
      category: body.category,
      title: title.slice(0, 300),
      instruction: String(body.instruction || feedbackText).slice(0, 10_000),
      rationale: String(body.rationale || 'Feedback confirmado pelo operador.').slice(0, 5000),
      severity: ['block', 'warn', 'prefer'].includes(body.severity) ? body.severity : 'prefer',
      scope: 'permanent',
      source: 'cliente',
      phrase: body.phrase ? String(body.phrase).slice(0, 500) : null,
      replacements: Array.isArray(body.replacements) ? body.replacements.map(String).filter(Boolean).slice(0, 20) : [],
      metric_visibility: ['publica', 'interna', 'omitida'].includes(body.metric_visibility) ? body.metric_visibility : null,
      allow_literal_quote: body.allow_literal_quote === true,
      examples: body.examples && typeof body.examples === 'object' ? body.examples : {},
      active: true,
      updated_at: new Date().toISOString(),
    }
    const result = existing
      ? await supabase.from('client_editorial_directives').update({ ...row, version: Number(existing.version || 0) + 1 }).eq('id', existing.id).select().single()
      : await supabase.from('client_editorial_directives').insert(row).select().single()
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
    directive = result.data
    await supabase.from('report_client_feedback').update({ directive_id: directive.id }).eq('id', feedback.id)
    await syncDraftEditorialSnapshot(supabase, draft)
  }
  return NextResponse.json({ feedback, directive }, { status: 201 })
}
