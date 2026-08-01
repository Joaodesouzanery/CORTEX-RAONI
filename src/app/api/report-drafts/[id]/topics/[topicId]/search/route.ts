import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { topicMatchesArticle } from '@/lib/monthly-agenda'
import { reportEvidenceItems } from '@/lib/report-drafts'
import type { MonthlyReportTopic } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  const { id, topicId } = await params
  const body = await req.json().catch(() => ({}))
  const afterFetch = body?.after_fetch === true
  const supabase = createClient()
  const [{ data: draft }, { data: topic }, evidence] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*').eq('id', id).single(),
    supabase.from('monthly_report_topics').select('*').eq('id', topicId).eq('draft_id', id).single(),
    reportEvidenceItems(supabase, id, false),
  ])
  if (!draft || !topic) return NextResponse.json({ error: 'Preparação ou tópico não encontrado.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })

  const typedTopic = topic as MonthlyReportTopic
  const matched = evidence.flatMap((item) => {
    const result = topicMatchesArticle(typedTopic, item.article_snapshot)
    return result.matched ? [{ item, terms: result.terms }] : []
  })
  const now = new Date().toISOString()
  const invalidateDraft = async () => {
    await Promise.all([
      supabase
        .from('monthly_report_drafts')
        .update({
          quality_status: 'pending',
          quality_summary: {},
          quality_checked_at: null,
          updated_at: now,
        })
        .eq('id', id),
      supabase
        .from('report_sections')
        .update({ status: 'stale', updated_at: now })
        .eq('draft_id', id)
        .eq('section_key', 2)
        .in('status', ['generated', 'edited']),
    ])
  }
  if (matched.length) {
    const { error: linkError } = await supabase.from('report_topic_evidence').upsert(
      matched.map(({ item, terms }) => ({
        topic_id: topicId,
        article_id: item.article_id,
        source: 'regra',
        confidence: 0.7,
        reason: `Termos encontrados: ${terms.join(', ')}`,
        updated_at: now,
      })),
      { onConflict: 'topic_id,article_id' }
    )
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
    await supabase
      .from('monthly_report_topics')
      .update({ coverage_status: 'review', gap_reason: null, gap_acknowledged_at: null, updated_at: now })
      .eq('id', topicId)
    await supabase.from('topic_search_runs').insert({
      topic_id: topicId,
      status: 'complete',
      query_snapshot: {
        inclusion_terms: topic.inclusion_terms,
        exclusion_terms: topic.exclusion_terms,
        local_archive: true,
      },
      matched_count: matched.length,
      linked_count: matched.length,
      started_at: now,
      finished_at: now,
    })
    await invalidateDraft()
    return NextResponse.json({ matched: matched.length, linked: matched.length, coverage_status: 'review' })
  }

  if (afterFetch) {
    const reason = 'Nenhuma publicação aderente foi encontrada após a busca complementar.'
    await Promise.all([
      supabase
        .from('monthly_report_topics')
        .update({ coverage_status: 'gap', gap_reason: reason, updated_at: now })
        .eq('id', topicId),
      supabase.from('topic_search_runs').insert({
        topic_id: topicId,
        status: 'gap',
        query_snapshot: {
          inclusion_terms: topic.inclusion_terms,
          exclusion_terms: topic.exclusion_terms,
          after_fetch: true,
        },
        started_at: now,
        finished_at: now,
      }),
    ])
    await invalidateDraft()
    return NextResponse.json({ matched: 0, linked: 0, coverage_status: 'gap' })
  }

  const { data: active } = await supabase
    .from('fetch_runs')
    .select('*')
    .in('status', ['pendente', 'executando'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let fetchRun = active
  let stableSourceId: string | null = null
  if (fetchRun) {
    const { data: activeSource } = await supabase
      .from('fetch_run_sources')
      .select('source_id')
      .eq('run_id', fetchRun.id)
      .order('source_id')
      .limit(1)
      .maybeSingle()
    stableSourceId = activeSource?.source_id || null
  }
  if (!fetchRun) {
    const { data: links } = await supabase
      .from('client_sources')
      .select('source_id, sources!inner(active)')
      .eq('client_id', draft.client_id)
      .eq('sources.active', true)
      .order('is_thematic', { ascending: false })
      .order('priority', { ascending: false })
      .limit(1)
    const sourceIds = Array.from(new Set((links || []).map((link) => link.source_id))).slice(0, 1)
    stableSourceId = sourceIds[0] || null
    if (sourceIds.length) {
      const { data: created, error: runError } = await supabase
        .from('fetch_runs')
        .insert({ trigger_type: 'manual', total_sources: sourceIds.length })
        .select()
        .single()
      if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
      fetchRun = created
      const { error: queueError } = await supabase
        .from('fetch_run_sources')
        .insert(sourceIds.map((sourceId) => ({ run_id: created.id, source_id: sourceId })))
      if (queueError) return NextResponse.json({ error: queueError.message }, { status: 500 })
    }
  }
  if (!fetchRun) {
    const reason = 'Nenhuma fonte ativa está vinculada ao cliente para a busca complementar.'
    await Promise.all([
      supabase
        .from('monthly_report_topics')
        .update({ coverage_status: 'gap', gap_reason: reason, updated_at: now })
        .eq('id', topicId),
      supabase.from('topic_search_runs').insert({
        topic_id: topicId,
        status: 'gap',
        query_snapshot: {
          inclusion_terms: topic.inclusion_terms,
          exclusion_terms: topic.exclusion_terms,
          configured_sources: true,
        },
        error: reason,
        started_at: now,
        finished_at: now,
      }),
    ])
    await invalidateDraft()
    return NextResponse.json({ matched: 0, linked: 0, coverage_status: 'gap', fetch_run_id: null })
  }
  await Promise.all([
    supabase
      .from('monthly_report_topics')
      .update({ coverage_status: 'searching', updated_at: now })
      .eq('id', topicId),
    supabase.from('topic_search_runs').insert({
      topic_id: topicId,
      status: 'searching',
      query_snapshot: {
        inclusion_terms: topic.inclusion_terms,
        exclusion_terms: topic.exclusion_terms,
        configured_sources: true,
        stable_source_id: stableSourceId,
      },
      fetch_run_id: fetchRun?.id || null,
      started_at: now,
    }),
  ])
  await invalidateDraft()
  return NextResponse.json({
    matched: 0,
    linked: 0,
    coverage_status: 'searching',
    fetch_run_id: fetchRun?.id || null,
  })
}
