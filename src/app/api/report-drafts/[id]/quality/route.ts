import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { evaluateReportQuality } from '@/lib/report-quality'
import { reportEvidenceItems } from '@/lib/report-drafts'
import type { MonthlyReportTopic, ReportSection } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [
    { data: draft, error },
    evidence,
    { data: topicRows },
    { data: topicLinks },
    { data: sections },
  ] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
  ])
  if (error || !draft) {
    return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  }
  const qualified = new Map(
    evidence
      .filter((item) => item.bucket === 'qualified')
      .map((item) => [item.article_id, item.classification_snapshot])
  )
  const topics = (topicRows || []).map((topic) => {
    const links = (topicLinks || []).filter((item) => item.topic_id === topic.id)
    const covered = links.some((link) => {
      const classification = qualified.get(link.article_id)
      return (
        classification &&
        (classification.verification_status === 'verificada' ||
        classification.editorial_review_state === 'revisado')
      )
    })
    const coverageStatus = covered
      ? 'covered'
      : topic.coverage_status === 'gap' && topic.gap_acknowledged_at
        ? 'gap'
        : links.length
          ? 'review'
          : 'unchecked'
    return {
      ...topic,
      coverage_status: coverageStatus,
      evidence: links,
      evidence_count: links.filter((link) => qualified.has(link.article_id)).length,
    } as MonthlyReportTopic
  })
  const changedTopics = topics.filter(
    (topic, index) => topic.coverage_status !== (topicRows || [])[index]?.coverage_status
  )
  for (const topic of changedTopics) {
    await supabase
      .from('monthly_report_topics')
      .update({ coverage_status: topic.coverage_status, updated_at: new Date().toISOString() })
      .eq('id', topic.id)
  }
  const { data: assignments } = await supabase
    .from('article_period_assignments')
    .select('article_id')
    .eq('client_id', draft.client_id)
    .eq('period_month', draft.period_month)
  const result = evaluateReportQuality({
    items: evidence,
    topics,
    sections: (sections || []) as ReportSection[],
    leadArticleId: draft.lead_article_id,
    periodMonth: draft.period_month,
    assignedArticleIds: new Set((assignments || []).map((item) => item.article_id)),
  })
  const now = new Date().toISOString()
  const summary = {
    ...result.funnel,
    blocking_checks: result.checks.filter((check) => check.status === 'blocked').length,
    warning_checks: result.checks.filter((check) => check.status === 'warning').length,
  }
  const { data: qualityCheck, error: insertError } = await supabase
    .from('report_quality_checks')
    .insert({
      draft_id: id,
      base_version: draft.base_version,
      status: result.status,
      checks: result.checks,
      summary,
    })
    .select()
    .single()
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  await supabase
    .from('monthly_report_drafts')
    .update({
      quality_status: result.status,
      quality_summary: summary,
      quality_checked_at: now,
      updated_at: now,
    })
    .eq('id', id)
  return NextResponse.json({ ...qualityCheck, funnel: result.funnel })
}
