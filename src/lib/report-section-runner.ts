import type { SupabaseClient } from '@supabase/supabase-js'
import { generateReportSection } from '@/lib/ai/claude'
import { buildAnnex, ensureLeadInSection, evidenceArticles, reportEvidenceItems } from '@/lib/report-drafts'
import { evidenceCitations } from '@/lib/report-quality'
import { directivesPrompt, lintEditorialDirectives } from '@/lib/editorial-directives'

/**
 * Erro de geração que carrega o status HTTP adequado, para a rota traduzir sem
 * inspecionar mensagens. 503 significa "falta configuração", não "deu errado":
 * o job deve parquear em waiting_configuration em vez de gastar tentativas.
 */
export class SectionGenerationError extends Error {
  status: number
  constructor(message: string, status = 500) {
    super(message)
    this.name = 'SectionGenerationError'
    this.status = status
  }
}

function monthLabel(periodMonth: string) {
  const [year, month] = periodMonth.slice(0, 7).split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 15))
  )
}

async function contextForDraft(supabase: SupabaseClient, draftId: string) {
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .select('*, clients(*)')
    .eq('id', draftId)
    .single()
  if (error || !draft) throw new SectionGenerationError(error?.message || 'Preparação não encontrada.', 404)
  if (!draft.lead_article_id) throw new SectionGenerationError('Escolha manualmente a matéria principal antes de gerar.', 409)
  if (draft.quality_status !== 'passed') {
    throw new SectionGenerationError('Execute e aprove os portões de qualidade antes de gerar as seções.', 409)
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
  if (!lead) throw new SectionGenerationError('A matéria principal não está mais na base. Atualize a escolha.', 409)
  const qualified = evidenceArticles(evidence, draft.lead_article_id)
  if (!qualified.length) throw new SectionGenerationError('A base qualificada está vazia.', 409)
  return { draft, evidence, lead, qualified, untriaged, topics: topics || [] }
}

/**
 * Gera e persiste UMA seção (1-9) de uma preparação mensal.
 *
 * Extraído da rota POST /api/report-drafts/[id]/sections/[section] sem mudança
 * de comportamento, para que o worker da automação possa gerar seções
 * diretamente — sem self-fetch e sem depender de APP_URL estar correto.
 */
export async function generateDraftSection(
  supabase: SupabaseClient,
  draftId: string,
  section: number,
  instructions?: string
) {
  if (!Number.isInteger(section) || section < 1 || section > 9) {
    throw new SectionGenerationError('Seção inválida.', 400)
  }
  // Sem chave, generateReportSection devolve mockSection() — uma string
  // "MODO MOCK" que a rota persistia como 'generated', envenenando o relatório
  // com texto de demonstração. Parar antes é o comportamento correto, e é o
  // mesmo que o estágio verify já adota.
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new SectionGenerationError('ANTHROPIC_API_KEY não configurada.', 503)
  }

  const { draft, evidence, lead, qualified, untriaged, topics } = await contextForDraft(supabase, draftId)
  if (draft.status === 'approved') {
    throw new SectionGenerationError('A versão aprovada é imutável. Crie uma nova versão.', 409)
  }
  await supabase
    .from('report_sections')
    .update({ status: 'generating', updated_at: new Date().toISOString() })
    .eq('draft_id', draftId)
    .eq('section_key', section)

  try {
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
    const citationByArticle = new Map(
      evidenceCitations(evidence).map((citation) => [citation.article_id, citation.code])
    )
    const strategicCards = evidence
      .filter((item) => item.bucket === 'qualified')
      .sort((a, b) => a.position - b.position)
      .map((item, index) => {
        const classification = item.classification_snapshot
        const code = citationByArticle.get(item.article_id)
        return [
          `${index + 1}. [${code}] ${item.article_snapshot.title}`,
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
    // Indicadores herdados do mês anterior não podem ser impressos como se
    // fossem deste mês. O placeholder aciona o item `placeholders` do
    // checklist, que bloqueia o finalize até alguém confirmar os números.
    const metricsUnconfirmed = draft.service_metrics_source !== 'humano'
    const metricsInstruction = metricsUnconfirmed
      ? 'INDICADORES DE SERVIÇO NÃO CONFIRMADOS: os números de reuniões, orientações e ações de imprensa ainda não foram validados por uma pessoa. Onde eles apareceriam, escreva exatamente [A PREENCHER: indicadores do mês] em vez de citar qualquer número.'
      : ''
    const prompt = [
      draft.monthly_instructions,
      instructions,
      directivesPrompt(draft.applied_editorial_snapshot, [
        'narrativa',
        'terminologia',
        'metrica',
        'estrutura',
      ]),
      leadInstruction,
      metricsInstruction,
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
      narrative_posture: draft.narrative_posture || 'consultivo_cauteloso',
    }
    const { data: priorSections } = await supabase
      .from('report_sections')
      .select('content')
      .eq('draft_id', draftId)
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
    if (section === 1 || section === 4) {
      const leadCode = citationByArticle.get(lead.article_id)
      markdown = ensureLeadInSection(markdown, section, lead, leadCode)
    }
    const directiveBlocks = lintEditorialDirectives(
      markdown,
      draft.applied_editorial_snapshot || null
    ).filter((check) => check.status === 'blocked')
    if (directiveBlocks.length) {
      throw new SectionGenerationError(
        `A seção gerada viola diretivas do cliente: ${directiveBlocks.map((check) => check.label).join('; ')}`,
        409
      )
    }
    const now = new Date().toISOString()
    const { data: current } = await supabase
      .from('report_sections')
      .select('version')
      .eq('draft_id', draftId)
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
      .eq('draft_id', draftId)
      .eq('section_key', section)
      .select()
      .single()
    if (saveError) throw new SectionGenerationError(saveError.message)
    await supabase.from('report_section_revisions').insert({
      draft_id: draftId,
      section_key: section,
      version: saved.version,
      origin: 'ia',
      content: saved.content,
    })
    await supabase
      .from('monthly_report_drafts')
      .update({ status: 'review', updated_at: now, error: null })
      .eq('id', draftId)
    return { section: saved, annex_preview: buildAnnex(evidence).slice(0, 1000) }
  } catch (generationError) {
    await supabase
      .from('report_sections')
      .update({ status: 'error', updated_at: new Date().toISOString() })
      .eq('draft_id', draftId)
      .eq('section_key', section)
    throw generationError
  }
}

/** Seções que ainda precisam ser geradas, na ordem 1-9. */
export async function pendingSectionKeys(supabase: SupabaseClient, draftId: string): Promise<number[]> {
  const { data: sections } = await supabase
    .from('report_sections')
    .select('section_key, content, status')
    .eq('draft_id', draftId)
    .order('section_key')
  return (sections || [])
    .filter((section) => !String(section.content || '').trim() || ['pending', 'stale', 'error'].includes(section.status))
    .map((section) => Number(section.section_key))
}
