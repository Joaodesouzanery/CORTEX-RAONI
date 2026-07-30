import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import {
  buildAnnex,
  buildDossier,
  buildQualifiedSection,
  evidenceCsv,
  reportEvidenceItems,
} from '@/lib/report-drafts'
import { buildAgendaSection } from '@/lib/report-quality'
import type { MonthlyReportTopic } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = new URL(req.url).searchParams.get('format') || 'dossier'
  const supabase = createClient()
  const [{ data: draft, error }, items, { data: sections }, { data: topicRows }, { data: topicLinks }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const evidence = items
  const qualifiedSet = new Set(evidence.filter((item) => item.bucket === 'qualified').map((item) => item.article_id))
  const topics = (topicRows || []).map((topic) => ({
    ...topic,
    evidence: (topicLinks || []).filter((link) => link.topic_id === topic.id),
    evidence_count: (topicLinks || []).filter(
      (link) => link.topic_id === topic.id && qualifiedSet.has(link.article_id)
    ).length,
  })) as MonthlyReportTopic[]
  const safeName = `${String(draft.clients?.name || 'cliente').replace(/[^a-z0-9]+/gi, '-')}-${draft.period_month.slice(0, 7)}`
  let content: string
  let contentType: string
  let extension: string
  if (format === 'csv') {
    content = evidenceCsv(evidence)
    contentType = 'text/csv; charset=utf-8'
    extension = 'csv'
  } else if (format === 'annex') {
    content = buildAnnex(evidence)
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else if (format === 'text') {
    content = [
      ...(sections || []).map((section) => section.content).filter(Boolean),
      buildAgendaSection(topics),
      buildQualifiedSection(evidence),
      '---',
      `*${draft.brand_snapshot?.footer || ''}*`,
    ].join('\n\n')
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else {
    content = buildDossier(evidence, topics)
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  }
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}-${format}.${extension}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
