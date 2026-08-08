import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { triageEvidence } from '@/lib/ai/triage'
import { fetchAll, refreshDraftEvidence, reportEvidenceItems } from '@/lib/report-drafts'
import type { ArticleSnapshot } from '@/types'
import { normalizeText } from '@/lib/relevance'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

function selectMemoryExamples(
  rows: Array<{ id?: string; kind: string; topic?: string | null; reason?: string; snapshot?: unknown }>,
  batch: Array<{ article_snapshot: ArticleSnapshot }>,
  kinds: string[]
) {
  const candidateTokens = new Set(
    normalizeText(batch.map((item) => `${item.article_snapshot.title} ${item.article_snapshot.excerpt || ''}`).join(' '))
      .split(/\s+/)
      .filter((token) => token.length >= 5)
  )
  return rows
    .filter((row) => kinds.includes(row.kind))
    .map((row) => {
      const text = normalizeText(`${row.topic || ''} ${row.reason || ''} ${JSON.stringify(row.snapshot || {})}`)
      const score = [...candidateTokens].filter((token) => text.includes(token)).length
      return { row, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ row }) => row)
}

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
  const { count: topicCount } = await supabase
    .from('monthly_report_topics')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', id)
  if (!topicCount) {
    return NextResponse.json(
      { error: 'Defina ao menos um tópico da agenda mensal antes da triagem.' },
      { status: 409 }
    )
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    await supabase
      .from('monthly_report_drafts')
      .update({ automation_status: 'waiting_configuration', automation_updated_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json(
      { error: 'Configure ANTHROPIC_API_KEY para executar a triagem. Nenhuma classificação foi alterada.', status: 'waiting_configuration' },
      { status: 503 }
    )
  }

  const [evidence, humanTags, triaged, { data: memoryRows }] = await Promise.all([
    reportEvidenceItems(supabase, id, false),
    fetchAll<{ article_id: string }>((from, to) =>
      supabase
        .from('article_client_tags')
        .select('article_id')
        .eq('client_id', draft.client_id)
        .or('report_role_source.eq.humano,editorial_review_state.eq.revisado')
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
    supabase
      .from('client_editorial_memory_items')
      .select('id, kind, source, topic, reason, snapshot, updated_at')
      .eq('client_id', draft.client_id)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(40),
  ])
  const protectedIds = new Set(humanTags.map((tag) => tag.article_id))
  const candidates = evidence.filter((item) => !protectedIds.has(item.article_id))
  const triagedIds = new Set(triaged.map((tag) => tag.article_id))
  const batch = candidates.filter((item) => !triagedIds.has(item.article_id)).slice(0, 20)
  if (!batch.length) {
    await refreshDraftEvidence(supabase, draft)
    return NextResponse.json({ processed: 0, remaining: 0, complete: true })
  }

  await supabase.from('monthly_report_drafts').update({ status: 'triaging' }).eq('id', id)
  try {
    const inclusionExamples = selectMemoryExamples(memoryRows || [], batch, ['evidencia'])
    const exclusionExamples = selectMemoryExamples(memoryRows || [], batch, ['contexto', 'ruido'])
    const priorBatches = Array.isArray(draft.editorial_memory_snapshot?.triage_batches)
      ? draft.editorial_memory_snapshot.triage_batches
      : []
    await supabase.from('monthly_report_drafts').update({
      editorial_memory_snapshot: {
        ...(draft.editorial_memory_snapshot || {}),
        triage_batches: [
          ...priorBatches.slice(-49),
          {
            captured_at: new Date().toISOString(),
            article_ids: batch.map((item) => item.article_id),
            inclusion_example_ids: inclusionExamples.map((item) => item.id).filter(Boolean),
            exclusion_example_ids: exclusionExamples.map((item) => item.id).filter(Boolean),
          },
        ],
      },
    }).eq('id', id)
    const result = await triageEvidence(
      batch.map((item) => item.article_snapshot as ArticleSnapshot),
      draft.clients,
      {
        inclusion: inclusionExamples,
        exclusion: exclusionExamples,
      },
      draft.applied_editorial_snapshot || null
    )
    const now = new Date().toISOString()
    for (const decision of result.decisions) {
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
          qualified_at: null,
          qualification_version: null,
          editorial_confidence: decision.editorial_confidence,
          geographic_scope: decision.geographic_scope,
          quality_flags: decision.quality_flags,
          adjudication_version: 1,
          qa_source: null,
          qa_checked_at: null,
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
        .update({ status: 'triaging', quality_status: 'pending', updated_at: now })
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
