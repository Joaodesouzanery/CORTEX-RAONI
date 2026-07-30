import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportTopicUpdateSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

async function editableDraft(
  supabase: ReturnType<typeof createClient>,
  draftId: string,
  topicId: string
) {
  const { data: topic } = await supabase
    .from('monthly_report_topics')
    .select('*, monthly_report_drafts!inner(status)')
    .eq('id', topicId)
    .eq('draft_id', draftId)
    .single()
  if (!topic) throw new Error('Tópico não encontrado.')
  if (topic.monthly_report_drafts?.status === 'approved') throw new Error('A versão aprovada é imutável.')
  return topic
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  const { id, topicId } = await params
  const parsed = reportTopicUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  try {
    await editableDraft(supabase, id, topicId)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tópico inválido.' }, { status: 409 })
  }
  const { acknowledge_gap, ...patch } = parsed.data
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('monthly_report_topics')
    .update({
      ...patch,
      gap_acknowledged_at: acknowledge_gap === true ? now : acknowledge_gap === false ? null : undefined,
      updated_at: now,
    })
    .eq('id', topicId)
    .eq('draft_id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (patch.coverage_status === 'covered') {
    await supabase
      .from('report_topic_evidence')
      .update({ human_confirmed: true, source: 'humano', updated_at: now })
      .eq('topic_id', topicId)
  }
  await supabase
    .from('monthly_report_drafts')
    .update({ quality_status: 'pending', quality_summary: {}, quality_checked_at: null, updated_at: now })
    .eq('id', id)
  await supabase
    .from('report_sections')
    .update({ status: 'stale', updated_at: now })
    .eq('draft_id', id)
    .in('status', ['generated', 'edited'])
  return NextResponse.json(data)
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  const { id, topicId } = await params
  const supabase = createClient()
  try {
    await editableDraft(supabase, id, topicId)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tópico inválido.' }, { status: 409 })
  }
  const { error } = await supabase.from('monthly_report_topics').delete().eq('id', topicId).eq('draft_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase
    .from('monthly_report_drafts')
    .update({ quality_status: 'pending', quality_summary: {}, quality_checked_at: null, updated_at: new Date().toISOString() })
    .eq('id', id)
  await supabase
    .from('report_sections')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('draft_id', id)
    .in('status', ['generated', 'edited'])
  return NextResponse.json({ deleted: true })
}
