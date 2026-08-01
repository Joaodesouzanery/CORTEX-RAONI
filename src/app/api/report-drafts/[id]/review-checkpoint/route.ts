import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { reportEvidenceItems } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: draft, error }, items] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const now = new Date().toISOString()
  const snapshot = {
    qualified: items.filter((item) => item.bucket === 'qualified').length,
    annex: items.filter((item) => item.bucket === 'annex').length,
    excluded: items.filter((item) => item.bucket === 'excluded').length,
    article_ids: items.map((item) => item.article_id),
  }
  const { data: checkpoint, error: checkpointError } = await supabase.from('report_review_checkpoints').insert({
    draft_id: id,
    base_version: draft.base_version,
    base_digest: draft.base_digest,
    snapshot,
  }).select().single()
  if (checkpointError) return NextResponse.json({ error: checkpointError.message }, { status: 500 })

  const ids = items.map((item) => item.article_id)
  for (let offset = 0; offset < ids.length; offset += 300) {
    const { data: tags } = await supabase
      .from('article_client_tags')
      .select('article_id, report_role, tema, editorial_reason, relevancia, geographic_scope, articles(title, publisher)')
      .eq('client_id', draft.client_id)
      .eq('editorial_review_state', 'revisado')
      .in('article_id', ids.slice(offset, offset + 300))
    const memory = (tags || []).filter((tag) => tag.report_role).map((tag) => ({
      client_id: draft.client_id,
      article_id: tag.article_id,
      kind: tag.report_role,
      source: 'humano',
      topic: tag.tema,
      reason: tag.editorial_reason || 'Decisão confirmada no marco de revisão.',
      snapshot: { article: tag.articles, relevancia: tag.relevancia, geographic_scope: tag.geographic_scope },
      updated_at: now,
    }))
    if (memory.length) await supabase.from('client_editorial_memory_items').upsert(memory, { onConflict: 'client_id,article_id,kind' })
  }
  await supabase.from('monthly_report_drafts').update({ change_summary: { checkpoint_at: now, added: [], removed: [], reclassified: [], content_changed: [], bucket_changes: [] }, updated_at: now }).eq('id', id)
  return NextResponse.json(checkpoint, { status: 201 })
}
