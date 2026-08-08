import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftItemsSchema } from '@/lib/validation'
import { refreshDraftEvidence } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = reportDraftItemsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft, error } = await supabase.from('monthly_report_drafts').select('*').eq('id', id).single()
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  const now = new Date().toISOString()
  const digest = createHash('sha256')
    .update(`${id}:${now}:${parsed.data.article_ids.slice().sort().join(',')}`)
    .digest('hex')
  const { data: document, error: documentError } = await supabase
    .from('source_documents')
    .insert({
      filename: `Seleção manual ${draft.period_month}`,
      storage_path: `manual://${id}/${digest}`,
      sha256: digest,
      document_type: 'mensagem',
      status: 'concluido',
      metadata: { kind: 'report_manual_selection', draft_id: id, article_ids: parsed.data.article_ids },
      processed_at: now,
    })
    .select()
    .single()
  if (documentError || !document) {
    return NextResponse.json({ error: documentError?.message || 'Falha ao registrar a seleção.' }, { status: 500 })
  }
  const assignments = parsed.data.article_ids.map((articleId) => ({
    article_id: articleId,
    client_id: draft.client_id,
    period_month: draft.period_month,
    source_document_id: document.id,
    editorial_reason:
      parsed.data.editorial_reason ||
      'Matéria adicionada manualmente à competência para sustentar o ciclo editorial do mês.',
    cycle_stage: parsed.data.cycle_stage || null,
  }))
  const { error: assignmentError } = await supabase
    .from('article_period_assignments')
    .upsert(assignments, { onConflict: 'article_id,client_id,period_month,source_document_id' })
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 })

  const { data: existing } = await supabase
    .from('article_client_tags')
    .select('article_id')
    .eq('client_id', draft.client_id)
    .in('article_id', parsed.data.article_ids)
  const existingIds = new Set((existing || []).map((row) => row.article_id))
  const missing = parsed.data.article_ids.filter((articleId) => !existingIds.has(articleId))
  if (missing.length) {
    const { error: tagError } = await supabase.from('article_client_tags').insert(
      missing.map((articleId) => ({
        article_id: articleId,
        client_id: draft.client_id,
        monitoring_status: 'revisao',
        classification_source: 'regra',
        report_role: 'contexto',
        report_role_source: 'regra',
        editorial_review_state: 'pendente',
        editorial_reason: 'Adicionada manualmente à preparação; requer qualificação.',
      }))
    )
    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 })
  }
  const refreshed = await refreshDraftEvidence(supabase, draft)
  return NextResponse.json({ ...refreshed, assigned: parsed.data.article_ids.length })
}
