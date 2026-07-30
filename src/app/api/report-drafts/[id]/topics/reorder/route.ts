import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportTopicReorderSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = reportTopicReorderSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('status').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  const { data: existing } = await supabase.from('monthly_report_topics').select('id').eq('draft_id', id)
  const existingIds = new Set((existing || []).map((topic) => topic.id))
  if (
    parsed.data.ordered_ids.length !== existingIds.size ||
    parsed.data.ordered_ids.some((topicId) => !existingIds.has(topicId))
  ) {
    return NextResponse.json({ error: 'A ordenação precisa conter todos os tópicos da preparação.' }, { status: 400 })
  }
  const now = new Date().toISOString()
  for (let index = 0; index < parsed.data.ordered_ids.length; index++) {
    const { error } = await supabase
      .from('monthly_report_topics')
      .update({ position: 1000 + index, updated_at: now })
      .eq('id', parsed.data.ordered_ids[index])
      .eq('draft_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  for (let index = 0; index < parsed.data.ordered_ids.length; index++) {
    const { error } = await supabase
      .from('monthly_report_topics')
      .update({ position: index + 1, updated_at: now })
      .eq('id', parsed.data.ordered_ids[index])
      .eq('draft_id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  return NextResponse.json({ ordered_ids: parsed.data.ordered_ids })
}
