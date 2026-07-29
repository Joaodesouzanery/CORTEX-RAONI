import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { buildQualifiedSection, reportEvidenceItems } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: draft, error }, { data: sections }, evidence] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
    reportEvidenceItems(supabase, id),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  if (!draft.lead_article_id) {
    return NextResponse.json({ error: 'Escolha a matéria principal antes de finalizar.' }, { status: 400 })
  }
  if (!sections || sections.length !== 9 || sections.some((section) => !section.content.trim())) {
    return NextResponse.json({ error: 'Gere ou edite todas as seções 1–9 antes de finalizar.' }, { status: 400 })
  }
  const items = evidence
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

  const mainContent = [
    ...sections.map((section) => section.content.trim()),
    buildQualifiedSection(items),
    '---',
    `*${draft.brand_snapshot?.footer || draft.brand_snapshot?.name || draft.clients?.name || ''}*`,
  ].join('\n\n')
  const qualifiedIds = items.filter((item) => item.bucket === 'qualified').map((item) => item.article_id)
  const counts = {
    qualified: qualifiedIds.length,
    annex: items.filter((item) => item.bucket === 'annex').length,
    excluded: items.filter((item) => item.bucket === 'excluded').length,
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
      },
      client_id: draft.client_id,
      draft_id: id,
      period_month: draft.period_month,
      version: (existing?.version || 0) + 1,
      lead_article_id: draft.lead_article_id,
      brand_snapshot: draft.brand_snapshot,
    })
    .select()
    .single()
  if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 })
  await supabase
    .from('monthly_report_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  return NextResponse.json({ report, counts }, { status: 201 })
}
