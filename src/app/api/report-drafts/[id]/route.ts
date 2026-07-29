import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftUpdateSchema } from '@/lib/validation'
import { reportEvidenceItems } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: draft, error }, evidence, { data: sections }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(*)').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const compactEvidence = evidence.map((item) => ({
    ...item,
    article_snapshot: { ...item.article_snapshot, content: null },
  }))
  return NextResponse.json({ ...draft, evidence_items: compactEvidence, sections: sections || [] })
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
  return NextResponse.json(data)
}
