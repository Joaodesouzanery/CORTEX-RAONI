import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { triageEvidence } from '@/lib/ai/triage'
import type { ArticleSnapshot } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .select('*, clients(name, sector, context)')
    .eq('id', id)
    .single()
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  }

  const { data: humanTags } = await supabase
    .from('article_client_tags')
    .select('article_id')
    .eq('client_id', draft.client_id)
    .eq('report_role_source', 'humano')
  const protectedIds = new Set((humanTags || []).map((tag) => tag.article_id))
  const { data: evidence } = await supabase
    .from('report_evidence_items')
    .select('article_id, article_snapshot, classification_snapshot, bucket')
    .eq('draft_id', id)
    .neq('bucket', 'excluded')
    .order('position')
  const candidates = (evidence || []).filter((item) => !protectedIds.has(item.article_id))
  const { data: triaged } = await supabase
    .from('article_client_tags')
    .select('article_id')
    .eq('client_id', draft.client_id)
    .not('triaged_at', 'is', null)
  const triagedIds = new Set((triaged || []).map((tag) => tag.article_id))
  const batch = candidates.filter((item) => !triagedIds.has(item.article_id)).slice(0, 20)
  if (!batch.length) return NextResponse.json({ processed: 0, remaining: 0, complete: true })

  await supabase.from('monthly_report_drafts').update({ status: 'triaging' }).eq('id', id)
  try {
    const result = await triageEvidence(
      batch.map((item) => item.article_snapshot as ArticleSnapshot),
      draft.clients
    )
    const now = new Date().toISOString()
    for (const rawDecision of result.decisions) {
      const current = batch.find((item) => item.article_id === rawDecision.article_id)
      const decision =
        result.source === 'regra' && current
          ? {
              ...rawDecision,
              report_role: current.bucket === 'qualified' ? ('evidencia' as const) : ('contexto' as const),
              editorial_score: Number(current.classification_snapshot?.editorial_score || rawDecision.editorial_score),
              editorial_reason: 'Triagem determinística baseada na classificação contextual existente.',
              cluster_label: String(current.classification_snapshot?.tema || 'Monitoramento contextual'),
            }
          : rawDecision
      const { error: updateError } = await supabase
        .from('article_client_tags')
        .update({
          report_role: decision.report_role,
          editorial_score: decision.editorial_score,
          editorial_reason: decision.editorial_reason,
          cluster_label: decision.cluster_label,
          report_role_source: result.source,
          triaged_at: now,
          triage_version: 1,
        })
        .eq('article_id', decision.article_id)
        .eq('client_id', draft.client_id)
        .or('report_role_source.neq.humano,report_role_source.is.null')
      if (updateError) throw new Error(updateError.message)
    }
    const remaining = Math.max(0, candidates.filter((item) => !triagedIds.has(item.article_id)).length - batch.length)
    await supabase
      .from('monthly_report_drafts')
      .update({ status: remaining ? 'triaging' : 'ready', updated_at: now })
      .eq('id', id)
    return NextResponse.json({
      processed: result.decisions.length,
      remaining,
      complete: remaining === 0,
      source: result.source,
    })
  } catch (triageError) {
    const message = triageError instanceof Error ? triageError.message : 'Falha na triagem.'
    await supabase.from('monthly_report_drafts').update({ status: 'error', error: message }).eq('id', id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
