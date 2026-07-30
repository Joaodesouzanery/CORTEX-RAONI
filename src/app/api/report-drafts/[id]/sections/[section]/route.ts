import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { generateReportSection } from '@/lib/ai/claude'
import { formatZodError, reportDraftSectionEditSchema, reportDraftSectionSchema } from '@/lib/validation'
import { buildAnnex, ensureLeadInSection, evidenceArticles, reportEvidenceItems } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function monthLabel(periodMonth: string) {
  const [year, month] = periodMonth.slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 15))
  )
}

async function contextForDraft(supabase: ReturnType<typeof createClient>, draftId: string) {
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .select('*, clients(*)')
    .eq('id', draftId)
    .single()
  if (error || !draft) throw new Error(error?.message || 'Preparação não encontrada.')
  if (!draft.lead_article_id) throw new Error('Escolha manualmente a matéria principal antes de gerar.')
  if (draft.quality_status !== 'passed') {
    throw new Error('Execute e aprove os portões de qualidade antes de gerar as seções.')
  }
  const evidence = await reportEvidenceItems(supabase, draftId, false)
  const { data: topics } = await supabase
    .from('monthly_report_topics')
    .select('*')
    .eq('draft_id', draftId)
    .order('position')
  const untriaged = evidence.filter(
    (item) =>
      item.bucket !== 'excluded' &&
      !item.classification_snapshot.triaged_at &&
      item.classification_snapshot.report_role_source !== 'humano'
  ).length
  const lead = evidence.find((item) => item.article_id === draft.lead_article_id)
  if (!lead) throw new Error('A matéria principal não está mais na base. Atualize a escolha.')
  const qualified = evidenceArticles(evidence, draft.lead_article_id)
  if (!qualified.length) throw new Error('A base qualificada está vazia.')
  return { draft, evidence, lead, qualified, untriaged, topics: topics || [] }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; section: string }> }
) {
  const { id, section: rawSection } = await params
  const section = Number(rawSection)
  if (!Number.isInteger(section) || section < 1 || section > 9) {
    return NextResponse.json({ error: 'Seção inválida.' }, { status: 400 })
  }
  const parsed = reportDraftSectionSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  try {
    const { draft, evidence, lead, qualified, untriaged, topics } = await contextForDraft(supabase, id)
    if (draft.status === 'approved') throw new Error('A versão aprovada é imutável. Crie uma nova versão.')
    await supabase
      .from('report_sections')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('draft_id', id)
      .eq('section_key', section)

    const clusters = new Map<string, number>()
    for (const item of evidence.filter((candidate) => candidate.bucket === 'annex')) {
      const key =
        String(item.classification_snapshot.cluster_label || item.classification_snapshot.tema || 'Outras ocorrências')
      clusters.set(key, (clusters.get(key) || 0) + 1)
    }
    const annexSummary = Array.from(clusters.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cluster, count]) => `- ${cluster}: ${count} ocorrência(s)`)
      .join('\n')
    const strategicCards = evidence
      .filter((item) => item.bucket === 'qualified')
      .sort((a, b) => a.position - b.position)
      .map((item, index) => {
        const classification = item.classification_snapshot
        return [
          `${index + 1}. ${item.article_snapshot.title}`,
          `Veículo: ${item.article_snapshot.publisher || item.article_snapshot.source_name || 'não identificado'}`,
          `Mensagem central: ${classification.central_message || item.article_snapshot.excerpt || item.article_snapshot.title}`,
          `Impacto para o cliente: ${classification.impact_summary || 'não detalhado'}`,
          `Efeito estratégico: ${classification.strategic_effect || 'informativo'}`,
          `Ação sugerida: ${classification.recommended_action || 'manter em monitoramento'}`,
          `Tema/pauta: ${classification.cluster_label || classification.tema || 'sem tema'}`,
        ].join('\n')
      })
      .join('\n\n')
    const { data: reference } = await supabase
      .from('reference_reports')
      .select('title, extracted_text')
      .eq('client_id', draft.client_id)
      .lte('period_month', draft.period_month)
      .eq('status', 'ready')
      .order('period_month', { ascending: false })
      .limit(1)
      .maybeSingle()
    const leadInstruction =
      `MATÉRIA PRINCIPAL ESCOLHIDA PELO CONSULTOR: “${lead.article_snapshot.title}”. ` +
      'Ela é a primeira evidência do contexto e DEVE aparecer nominalmente no Sumário Executivo e como eixo da subseção 4.1.'
    const prompt = [
      draft.monthly_instructions,
      parsed.data.instructions,
      leadInstruction,
      `AGENDA MENSAL OBRIGATÓRIA — trate estes temas explicitamente quando forem pertinentes à seção e não invente cobertura ausente:\n${topics
        .map((topic) => `- ${topic.title}: ${topic.coverage_status}${topic.rationale ? ` — ${topic.rationale}` : ''}`)
        .join('\n')}`,
      `FICHAS ESTRATÉGICAS DA BASE QUALIFICADA — use-as como eixo analítico e cite somente fatos sustentados pelas publicações:\n${strategicCards}`,
      untriaged
        ? `AVISO DE COBERTURA: ${untriaged} item(ns) permanecem sem triagem completa e foram preservados no anexo; não os trate como evidência direta.`
        : '',
      `ANEXO MONITORADO — use apenas como sinal agregado, nunca como evidência direta:\n${annexSummary || '- vazio'}`,
      reference?.extracted_text
        ? `REFERÊNCIA ESTRUTURAL ANTERIOR (${reference.title}) — use apenas como parâmetro de qualidade e estrutura; não trate como fato do mês:\n${reference.extracted_text.slice(0, 8000)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const metrics = draft.service_metrics || {}
    const client = {
      ...draft.clients,
      contratante: draft.brand_snapshot?.name || draft.clients.contratante,
    }
    const { data: priorSections } = await supabase
      .from('report_sections')
      .select('content')
      .eq('draft_id', id)
      .lt('section_key', section)
      .in('status', ['generated', 'edited', 'stale'])
      .order('section_key')
    const prior = (priorSections || []).map((row) => row.content).join('\n\n').slice(-5000) || undefined
    let markdown = await generateReportSection(
      section - 1,
      qualified,
      prompt,
      {
        mes: monthLabel(draft.period_month),
        reunioes_presenciais: Number(metrics.reunioes_presenciais || 0),
        reunioes_virtuais: Number(metrics.reunioes_virtuais || 0),
        orientacoes: Number(metrics.orientacoes || 0),
        acoes_imprensa: Number(metrics.acoes_imprensa || 0),
      },
      client,
      prior
    )
    if (section === 1 || section === 4) markdown = ensureLeadInSection(markdown, section, lead)
    const now = new Date().toISOString()
    const { data: current } = await supabase
      .from('report_sections')
      .select('version')
      .eq('draft_id', id)
      .eq('section_key', section)
      .single()
    const { data: saved, error: saveError } = await supabase
      .from('report_sections')
      .update({
        content: markdown,
        status: 'generated',
        version: (current?.version || 0) + 1,
        generated_at: now,
        updated_at: now,
      })
      .eq('draft_id', id)
      .eq('section_key', section)
      .select()
      .single()
    if (saveError) throw new Error(saveError.message)
    await supabase
      .from('monthly_report_drafts')
      .update({ status: 'review', updated_at: now, error: null })
      .eq('id', id)
    return NextResponse.json({ section: saved, annex_preview: buildAnnex(evidence).slice(0, 1000) })
  } catch (generationError) {
    const message = generationError instanceof Error ? generationError.message : 'Falha ao gerar seção.'
    await supabase
      .from('report_sections')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('draft_id', id)
      .eq('section_key', section)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; section: string }> }
) {
  const { id, section: rawSection } = await params
  const section = Number(rawSection)
  const parsed = reportDraftSectionEditSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('status').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  }
  const now = new Date().toISOString()
  const { data: current } = await supabase
    .from('report_sections')
    .select('version')
    .eq('draft_id', id)
    .eq('section_key', section)
    .single()
  const { data, error } = await supabase
    .from('report_sections')
    .update({
      content: parsed.data.content,
      status: 'edited',
      version: (current?.version || 0) + 1,
      updated_at: now,
    })
    .eq('draft_id', id)
    .eq('section_key', section)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('monthly_report_drafts').update({ status: 'review', updated_at: now }).eq('id', id)
  return NextResponse.json({ section: data })
}
