import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { compareReferenceToDraft } from '@/lib/report-delivery-comparison'
import type { DirectiveCategory } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reference_report_comparisons')
    .select('*, reference_reports(title, reference_kind, created_at), report_memory_suggestions(*)')
    .eq('draft_id', id)
    .order('compared_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body?.reference_report_id) {
    return NextResponse.json({ error: 'Relatório entregue não informado.' }, { status: 400 })
  }
  const supabase = createClient()
  try {
    return NextResponse.json(await compareReferenceToDraft(supabase, id, body.reference_report_id))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao comparar a entrega.' },
      { status: 500 }
    )
  }
}

function directiveKey(id: string) {
  return `delivery-feedback-${id}`
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const ids = Array.isArray(body?.suggestion_ids) ? body.suggestion_ids.map(String) : []
  const action = body?.action === 'accept' ? 'accept' : body?.action === 'dismiss' ? 'dismiss' : null
  if (!ids.length || !action) return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase
    .from('monthly_report_drafts')
    .select('client_id, status')
    .eq('id', id)
    .single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  // Accepting a suggestion creates future-facing memory only. It never edits
  // the approved report or its immutable snapshots.
  const { data: suggestions, error } = await supabase
    .from('report_memory_suggestions')
    .select('*, reference_report_comparisons!inner(draft_id)')
    .in('id', ids)
    .eq('status', 'pending')
    .eq('reference_report_comparisons.draft_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  for (const suggestion of suggestions || []) {
    let directiveId: string | null = null
    if (action === 'accept') {
      const row = {
        client_id: draft.client_id,
        directive_key: directiveKey(suggestion.id),
        category: suggestion.category as DirectiveCategory,
        title: suggestion.title,
        instruction: suggestion.suggestion,
        rationale: 'Diferença entre o pacote CORTEX e o relatório entregue, confirmada pelo operador.',
        severity: 'prefer',
        scope: 'permanent',
        source: 'curado',
        examples: suggestion.evidence || {},
      }
      const { data: existing } = await supabase
        .from('client_editorial_directives')
        .select('id, version')
        .eq('client_id', draft.client_id)
        .eq('directive_key', row.directive_key)
        .eq('scope', 'permanent')
        .maybeSingle()
      const directiveResult = existing
        ? await supabase
            .from('client_editorial_directives')
            .update({ ...row, version: Number(existing.version || 0) + 1, active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select('id')
            .single()
        : await supabase.from('client_editorial_directives').insert(row).select('id').single()
      const { data: directive, error: directiveError } = directiveResult
      if (directiveError) return NextResponse.json({ error: directiveError.message }, { status: 500 })
      directiveId = directive.id
    }
    await supabase
      .from('report_memory_suggestions')
      .update({
        status: action === 'accept' ? 'accepted' : 'dismissed',
        directive_id: directiveId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', suggestion.id)
  }
  return NextResponse.json({ updated: suggestions?.length || 0 })
}
