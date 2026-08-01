import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { verifyEvidenceBatch } from '@/lib/ai/verify'
import { refreshDraftEvidence, reportEvidenceItems } from '@/lib/report-drafts'
import type { ArticleSnapshot, MonthlyReportTopic } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: draft, error }, evidence, { data: topicRows }, { data: topicLinks }] = await Promise.all([
    supabase
      .from('monthly_report_drafts')
      .select('*, clients(name, sector, context)')
      .eq('id', id)
      .single(),
    reportEvidenceItems(supabase, id, false),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('topic_id, article_id, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
  ])
  if (error || !draft) {
    return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  }
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    await supabase
      .from('monthly_report_drafts')
      .update({ automation_status: 'waiting_configuration', automation_updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json(
      { error: 'Configure ANTHROPIC_API_KEY para executar a verificação. Nenhuma evidência foi alterada.', status: 'waiting_configuration' },
      { status: 503 }
    )
  }
  const evidenceById = new Map(evidence.map((item) => [item.article_id, item]))
  const evidenceIds = evidence.map((item) => item.article_id)
  if (!evidenceIds.length) return NextResponse.json({ processed: 0, remaining: 0, complete: true })

  const { data: proposed, error: proposedError } = await supabase
    .from('article_client_tags')
    .select(
      'article_id, report_role, report_role_source, editorial_reason, impact_summary, editorial_confidence, cita_cliente, tom, qa_checked_at, editorial_review_state'
    )
    .eq('client_id', draft.client_id)
    .eq('report_role', 'evidencia')
    .in('article_id', evidenceIds)
    .or('qa_checked_at.is.null,adjudication_version.lt.2')
    .neq('report_role_source', 'humano')
  if (proposedError) return NextResponse.json({ error: proposedError.message }, { status: 500 })

  const batch = (proposed || []).slice(0, 10)
  if (!batch.length) {
    return NextResponse.json({ processed: 0, remaining: 0, complete: true })
  }
  const topicIdsByArticle = new Map<string, string[]>()
  for (const link of topicLinks || []) {
    const ids = topicIdsByArticle.get(link.article_id) || []
    ids.push(link.topic_id)
    topicIdsByArticle.set(link.article_id, ids)
  }
  const input = batch.flatMap((tag) => {
    const item = evidenceById.get(tag.article_id)
    if (!item) return []
    return [
      {
        article: item.article_snapshot as ArticleSnapshot,
        proposed_role: 'evidencia' as const,
        proposed_reason: tag.editorial_reason,
        proposed_impact: tag.impact_summary,
        proposed_confidence: tag.editorial_confidence,
        cita_cliente: tag.cita_cliente === true,
        tom: tag.tom,
        topic_ids: topicIdsByArticle.get(tag.article_id) || [],
      },
    ]
  })

  try {
    await supabase.from('monthly_report_drafts').update({ quality_status: 'running' }).eq('id', id)
    const result = await verifyEvidenceBatch(input, draft.clients, (topicRows || []) as MonthlyReportTopic[])
    const now = new Date().toISOString()
    for (const decision of result.decisions) {
      const { error: updateError } = await supabase
        .from('article_client_tags')
        .update({
          report_role: decision.report_role,
          editorial_confidence: decision.editorial_confidence,
          verification_status: decision.verification_status,
          editorial_review_state: decision.editorial_review_state,
          geographic_scope: decision.geographic_scope,
          quality_flags: decision.quality_flags,
          editorial_reason: decision.reason,
          qa_source: result.source,
          qa_checked_at: now,
          adjudication_version: 2,
          qualified_at:
            decision.accepted && decision.editorial_review_state !== 'pendente' ? now : null,
          qualification_version:
            decision.accepted && decision.editorial_review_state !== 'pendente' ? 2 : null,
        })
        .eq('article_id', decision.article_id)
        .eq('client_id', draft.client_id)
        .neq('report_role_source', 'humano')
      if (updateError) throw new Error(updateError.message)
    }
    const remaining = Math.max(0, (proposed || []).length - batch.length)
    if (!remaining) await refreshDraftEvidence(supabase, draft)
    return NextResponse.json({
      processed: result.decisions.length,
      remaining,
      complete: remaining === 0,
      source: result.source,
    })
  } catch (verificationError) {
    const message = verificationError instanceof Error ? verificationError.message : 'Falha na verificação.'
    await supabase
      .from('monthly_report_drafts')
      .update({ quality_status: 'blocked', status: 'error', error: message })
      .eq('id', id)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
