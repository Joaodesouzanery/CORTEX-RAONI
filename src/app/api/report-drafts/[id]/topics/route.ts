import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportTopicCreateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: topics, error }, { data: evidence }, { data: runs }] = await Promise.all([
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
    supabase
      .from('topic_search_runs')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    (topics || []).map((topic) => ({
      ...topic,
      evidence: (evidence || []).filter((item) => item.topic_id === topic.id),
      evidence_count: (evidence || []).filter((item) => item.topic_id === topic.id).length,
      search_runs: (runs || []).filter((run) => run.topic_id === topic.id),
    }))
  )
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = reportTopicCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('status').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  const { data: last } = await supabase
    .from('monthly_report_topics')
    .select('position')
    .eq('draft_id', id)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('monthly_report_topics')
    .insert({ draft_id: id, position: (last?.position || 0) + 1, ...parsed.data })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.all([
    supabase
      .from('monthly_report_drafts')
      .update({ quality_status: 'pending', quality_summary: {}, quality_checked_at: null, updated_at: now })
      .eq('id', id),
    supabase
      .from('report_sections')
      .update({ status: 'stale', updated_at: now })
      .eq('draft_id', id)
      .in('status', ['generated', 'edited']),
  ])
  return NextResponse.json(data, { status: 201 })
}
