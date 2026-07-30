import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { buildQualifiedSection, reportEvidenceItems } from '@/lib/report-drafts'
import {
  auditReportTraceability,
  buildAgendaSection,
  buildMethodologyNote,
  buildMethodologySnapshot,
  buildThematicMatrix,
  evidenceCitations,
} from '@/lib/report-quality'
import type { MonthlyReportTopic } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await req.json().catch(() => ({}))
  const supabase = createClient()
  const [
    { data: draft, error },
    { data: sections },
    evidence,
    { data: topicRows },
    { data: topicLinks },
    { data: latestQuality },
  ] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
    reportEvidenceItems(supabase, id),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
    supabase
      .from('report_quality_checks')
      .select('*')
      .eq('draft_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  if (!draft.lead_article_id) {
    return NextResponse.json({ error: 'Escolha a matéria principal antes de finalizar.' }, { status: 400 })
  }
  if (
    !sections ||
    sections.length !== 9 ||
    sections.some((section) => !section.content.trim() || section.status === 'stale' || section.status === 'error')
  ) {
    return NextResponse.json({ error: 'Gere ou edite todas as seções 1–9 antes de finalizar.' }, { status: 400 })
  }
  if (
    draft.quality_status !== 'passed' ||
    !latestQuality ||
    latestQuality.status !== 'passed' ||
    latestQuality.base_version !== draft.base_version
  ) {
    return NextResponse.json(
      {
        error: 'Execute os portões de qualidade sobre a versão atual da base antes de finalizar.',
        code: 'QUALITY_CHECK_REQUIRED',
      },
      { status: 409 }
    )
  }
  const items = evidence
  const pendingReview = items.filter(
    (item) => item.bucket === 'annex' && item.classification_snapshot.editorial_review_state === 'pendente'
  ).length
  const lead = items.find((item) => item.article_id === draft.lead_article_id)
  if (!lead) return NextResponse.json({ error: 'A matéria principal não está na base atual.' }, { status: 400 })
  const leadTitle = lead.article_snapshot.title.toLocaleLowerCase('pt-BR')
  const section1 = sections.find((section) => section.section_key === 1)?.content.toLocaleLowerCase('pt-BR') || ''
  const section4 = sections.find((section) => section.section_key === 4)?.content.toLocaleLowerCase('pt-BR') || ''
  if (!section1.includes(leadTitle) || !section4.includes(leadTitle)) {
    return NextResponse.json(
      { error: 'A matéria principal precisa constar nominalmente no Sumário Executivo e na seção 4.1.' },
      { status: 400 }
    )
  }

  const qualifiedSet = new Set(items.filter((item) => item.bucket === 'qualified').map((item) => item.article_id))
  const topics = (topicRows || []).map((topic) => ({
    ...topic,
    evidence: (topicLinks || []).filter((link) => link.topic_id === topic.id),
    evidence_count: (topicLinks || []).filter(
      (link) => link.topic_id === topic.id && qualifiedSet.has(link.article_id)
    ).length,
  })) as MonthlyReportTopic[]
  const methodology = buildMethodologySnapshot(items)
  const citations = evidenceCitations(items)
  const traceabilityChecks = auditReportTraceability({
    sections,
    citations,
    posture: draft.narrative_posture || 'consultivo_cauteloso',
    clientName: draft.clients?.name || 'cliente',
  })
  const traceabilityBlocked = traceabilityChecks.filter((check) => check.status === 'blocked')
  if (traceabilityBlocked.length) {
    return NextResponse.json(
      {
        error: 'O texto ainda possui pendências de rastreabilidade ou postura narrativa.',
        code: 'TRACEABILITY_CHECK_FAILED',
        checks: traceabilityBlocked,
      },
      { status: 409 }
    )
  }
  const analyticalSections = sections.map((section) =>
    section.section_key === 2
      ? `${section.content.trim()}\n\n${buildThematicMatrix(topics, items)}`
      : section.content.trim()
  )
  const mainContent = [
    buildMethodologyNote(methodology, draft.clients?.name || 'cliente'),
    ...analyticalSections,
    buildAgendaSection(topics),
    buildQualifiedSection(items),
    '---',
    `*${draft.brand_snapshot?.footer || draft.brand_snapshot?.name || draft.clients?.name || ''}*`,
  ].join('\n\n')
  const qualifiedIds = items.filter((item) => item.bucket === 'qualified').map((item) => item.article_id)
  const counts = {
    qualified: qualifiedIds.length,
    annex: items.filter((item) => item.bucket === 'annex').length,
    excluded: items.filter((item) => item.bucket === 'excluded').length,
    pending_review: pendingReview,
  }
  const { data: existing } = await supabase
    .from('reports')
    .select('version')
    .eq('draft_id', id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .insert({
      prompt: draft.monthly_instructions || '',
      article_ids: qualifiedIds,
      content: mainContent,
      metadata: {
        service_metrics: draft.service_metrics,
        evidence_counts: counts,
        base_version: draft.base_version,
        handoff: 'claude_design',
        pending_annex_review: pendingReview,
        agenda_topics: topics.length,
        quality_status: latestQuality.status,
        narrative_posture: draft.narrative_posture || 'consultivo_cauteloso',
      },
      client_id: draft.client_id,
      draft_id: id,
      period_month: draft.period_month,
      version: (existing?.version || 0) + 1,
      lead_article_id: draft.lead_article_id,
      brand_snapshot: draft.brand_snapshot,
      agenda_snapshot: topics,
      quality_snapshot: { ...latestQuality, traceability_checks: traceabilityChecks },
      methodology_snapshot: methodology,
      citation_snapshot: citations,
      narrative_posture: draft.narrative_posture || 'consultivo_cauteloso',
    })
    .select()
    .single()
  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })
  await supabase
    .from('monthly_report_drafts')
    .update({
      status: 'approved',
      methodology_snapshot: methodology,
      quality_summary: {
        ...(draft.quality_summary || {}),
        traceability_checks: traceabilityChecks,
      },
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return NextResponse.json({ report, counts }, { status: 201 })
}
