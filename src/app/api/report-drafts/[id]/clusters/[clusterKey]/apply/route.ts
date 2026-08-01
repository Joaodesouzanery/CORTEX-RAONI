import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { refreshDraftEvidence } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string; clusterKey: string }> }) {
  const { id, clusterKey } = await params
  const body = await req.json().catch(() => null)
  if (!body || !['evidencia', 'contexto', 'ruido'].includes(body.role)) {
    return NextResponse.json({ error: 'Papel editorial inválido.' }, { status: 400 })
  }
  const supabase = createClient()
  const [{ data: draft }, { data: cluster }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*').eq('id', id).single(),
    supabase.from('report_clusters').select('*').eq('draft_id', id).eq('cluster_key', clusterKey).single(),
  ])
  if (!draft || !cluster) return NextResponse.json({ error: 'Pauta ou preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  const articleIds = Array.isArray(cluster.article_ids) ? cluster.article_ids : []
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('article_client_tags')
    .update({
      report_role: body.role,
      report_role_source: 'humano',
      editorial_review_state: 'revisado',
      editorial_reason: String(body.reason || cluster.suggestion_reason || 'Decisão humana aplicada à pauta.').slice(0, 2000),
      triaged_at: now,
      updated_at: now,
    })
    .eq('client_id', draft.client_id)
    .in('article_id', articleIds)
    .or('report_role_source.neq.humano,report_role_source.is.null')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('report_clusters').update({ human_role: body.role, human_label: body.label || cluster.label, human_decided_at: now, updated_at: now }).eq('id', cluster.id)
  const refreshed = await refreshDraftEvidence(supabase, draft)
  return NextResponse.json({ applied: articleIds.length, ...refreshed })
}
