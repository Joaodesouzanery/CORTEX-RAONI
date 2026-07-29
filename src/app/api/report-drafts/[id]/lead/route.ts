import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftLeadSchema } from '@/lib/validation'
import { refreshDraftEvidence } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = reportDraftLeadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft, error } = await supabase.from('monthly_report_drafts').select('*').eq('id', id).single()
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const { data: evidence } = await supabase
    .from('report_evidence_items')
    .select('article_id')
    .eq('draft_id', id)
    .eq('article_id', parsed.data.article_id)
    .maybeSingle()
  if (!evidence) return NextResponse.json({ error: 'A matéria não pertence à base deste mês.' }, { status: 400 })

  const now = new Date().toISOString()
  const { error: tagError } = await supabase
    .from('article_client_tags')
    .update({
      report_role: 'evidencia',
      editorial_score: 100,
      editorial_reason: 'Escolhida manualmente como matéria principal.',
      report_role_source: 'humano',
      triaged_at: now,
      triage_version: 1,
      monitoring_status: 'confirmado',
      relevancia: 'alta',
    })
    .eq('article_id', parsed.data.article_id)
    .eq('client_id', draft.client_id)
  if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 })
  await supabase
    .from('monthly_report_drafts')
    .update({ lead_article_id: parsed.data.article_id, updated_at: now })
    .eq('id', id)
  return NextResponse.json(await refreshDraftEvidence(supabase, { ...draft, lead_article_id: parsed.data.article_id }))
}

