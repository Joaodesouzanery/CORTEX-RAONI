import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { triageEvidence } from '@/lib/ai/triage'
import { fetchAll, refreshDraftEvidence, reportEvidenceItems } from '@/lib/report-drafts'
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

  const [evidence, humanTags, triaged] = await Promise.all([
    reportEvidenceItems(supabase, id, false),
    fetchAll<{ article_id: string }>((from, to) =>
      supabase
        .from('article_client_tags')
        .select('article_id')
        .eq('client_id', draft.client_id)
        .or(
          'report_role_source.eq.humano,classification_source.eq.humano,editorial_review_state.eq.revisado'
        )
        .range(from, to)
    ),
    fetchAll<{ article_id: string }>((from, to) =>
      supabase
        .from('article_client_tags')
        .select('article_id')
        .eq('client_id', draft.client_id)
        .not('triaged_at', 'is', null)
        .range(from, to)
    ),
  ])
  const protectedIds = new Set(humanTags.map((tag) => tag.article_id))
  const candidates = evidence.filter((item) => !protectedIds.has(item.article_id))
  const triagedIds = new Set(triaged.map((tag) => tag.article_id))
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
              central_message: String(current.article_snapshot.excerpt || current.article_snapshot.title),
              impact_summary: String(
                current.classification_snapshot?.impact_summary || 'Impacto inferido pela classificação contextual.'
              ),
              strategic_effect: 'informativo' as const,
              recommended_action: 'Manter em monitoramento e revisar se o tema ganhar relevância.',
              verification_status:
                current.article_snapshot.content_status === 'integral' ? ('verificada' as const) : ('parcial' as const),
              editorial_review_state:
                current.classification_snapshot?.monitoring_status === 'revisao'
                  ? ('pendente' as const)
                  : ('automatico' as const),
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
          central_message: decision.central_message,
          impact_summary: decision.impact_summary,
          strategic_effect: decision.strategic_effect,
          recommended_action: decision.recommended_action,
          verification_status: decision.verification_status,
          editorial_review_state: decision.editorial_review_state,
          qualified_at: now,
          qualification_version: 1,
        })
        .eq('article_id', decision.article_id)
        .eq('client_id', draft.client_id)
        .or('report_role_source.neq.humano,report_role_source.is.null')
      if (updateError) throw new Error(updateError.message)
    }
    const remaining = Math.max(0, candidates.filter((item) => !triagedIds.has(item.article_id)).length - batch.length)
    if (remaining) {
      await supabase
        .from('monthly_report_drafts')
        .update({ status: 'triaging', updated_at: now })
        .eq('id', id)
    } else {
      // Replace the immutable evidence snapshots only after the final batch so
      // section generation sees every triage decision without rewriting 1k+
      // rows on each 20-item request.
      await refreshDraftEvidence(supabase, draft)
    }
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
