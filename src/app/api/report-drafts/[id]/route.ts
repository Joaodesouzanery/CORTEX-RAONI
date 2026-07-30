import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftUpdateSchema } from '@/lib/validation'
import { reportEvidenceItems } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [
    { data: draft, error },
    evidence,
    { data: sections },
    { data: topics },
    { data: topicEvidence },
    { data: qualityChecks },
  ] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(*)').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
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
      .limit(5),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const compactEvidence = evidence.map((item) => ({
    ...item,
    article_snapshot: { ...item.article_snapshot, content: null },
  }))
  const enrichedTopics = (topics || []).map((topic) => ({
    ...topic,
    evidence: (topicEvidence || []).filter((item) => item.topic_id === topic.id),
    evidence_count: (topicEvidence || []).filter((item) => item.topic_id === topic.id).length,
  }))
  return NextResponse.json({
    ...draft,
    evidence_items: compactEvidence,
    sections: sections || [],
    topics: enrichedTopics,
    quality_checks: qualityChecks || [],
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = reportDraftUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('status').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  }
  const { data, error } = await supabase
    .from('monthly_report_drafts')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase
    .from('report_sections')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('draft_id', id)
    .in('status', ['generated', 'edited'])
  return NextResponse.json(data)
}
