import type {
  ArticleSnapshot,
  EvidenceCitation,
  GeographicScope,
  MethodologySnapshot,
  MonthlyReportTopic,
  QualificationFunnel,
  QualityFlag,
  ReportEvidenceItem,
  ReportPosture,
  ReportQualityCheckItem,
  ReportSection,
  SourceVerificationStatus,
  AppliedEditorialSnapshot,
} from '@/types'
import { normalizeText } from '@/lib/relevance'
import { lintEditorialDirectives, metricVisibility } from '@/lib/editorial-directives'

const PARA_ENTITIES =
  /\b(carajas|belem|parauapebas|maraba|canaa dos carajas|oriximina|juruti|trombetas|barcarena|tapajos|xingu)\b/
const AMAZON_TERMS = /\b(amazonia|amazonico|amazonica|bioma amazonico)\b/
const BRAZIL_TERMS = /\b(brasil|brasileiro|brasileira|nacional|governo federal|anm|cfem|mme)\b/
const FOREIGN_TERMS =
  /\b(china|estados unidos|eua|uniao europeia|europa|australia|canada|chile|peru|congo|africa|india|indonesia|russia)\b/

function reportMonthBounds(period: string) {
  const [year, month] = period.slice(0, 7).split('-').map(Number)
  const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00-03:00`)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function articleQualityText(article: Pick<ArticleSnapshot, 'title' | 'excerpt' | 'content'>) {
  return normalizeText([article.title, article.excerpt, article.content].filter(Boolean).join(' '))
}

export function inferGeographicScope(article: Pick<ArticleSnapshot, 'title' | 'excerpt' | 'content'>): GeographicScope {
  const text = articleQualityText(article)
  const raw = [article.title, article.excerpt, article.content]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR')
  // `normalizeText` removes accents, so an isolated `para` could be either the
  // state or the Portuguese preposition. The state name is accepted only from
  // the original accented text; unaccented matching requires a local entity.
  if (/(?:^|[^\p{L}])pará(?:$|[^\p{L}])/u.test(raw) || PARA_ENTITIES.test(text)) return 'para'
  if (AMAZON_TERMS.test(text)) return 'amazonia'
  if (BRAZIL_TERMS.test(text)) return 'brasil'
  if (FOREIGN_TERMS.test(text)) return 'internacional'
  return 'indeterminado'
}

export function deterministicQualityFlags(
  article: Pick<ArticleSnapshot, 'title' | 'excerpt' | 'content' | 'content_status'>,
  scope = inferGeographicScope(article)
): QualityFlag[] {
  const text = articleQualityText(article)
  const flags = new Set<QualityFlag>()
  if (article.content_status !== 'integral' || text.length < 600) flags.add('texto_insuficiente')
  if (/\b(criptomoeda|bitcoin|ethereum|minerar cripto|mineracao de cripto)\b/.test(text)) {
    flags.add('ambiguidade_criptomoeda')
  }
  if (/\b(ibovespa|vale3|cmin3|acoes|bolsa|dividendos|cotacao|etf|carteira recomendada|day trade)\b/.test(text)) {
    flags.add('possivel_mercado_financeiro')
  }
  if (/\b(nuclear|radiologica|ansn|wano|reator)\b/.test(text) && !/\b(minerais?|mineracao)\b/.test(text)) {
    flags.add('energia_nuclear_desconectada')
  }
  if (/\b(caminhao|escavadeira|mangueira|equipamento|mining equipment|caterpillar|komatsu)\b/.test(text)) {
    flags.add('equipamento_comercial')
  }
  if (scope === 'internacional' && !/\b(brasil|amazonia|carajas|cadeia brasileira|setor brasileiro)\b/.test(text)) {
    flags.add('exterior_sem_impacto_local')
  }
  return Array.from(flags)
}

export function qualificationFunnel(items: ReportEvidenceItem[]): QualificationFunnel {
  const included = items.filter((item) => item.bucket !== 'excluded')
  return {
    detected: items.length,
    triaged: included.filter(
      (item) =>
        Boolean(item.classification_snapshot.triaged_at) ||
        item.classification_snapshot.report_role_source === 'humano'
    ).length,
    verified: included.filter(
      (item) =>
        item.classification_snapshot.editorial_review_state === 'revisado' ||
        (item.classification_snapshot.verification_status === 'verificada' &&
          Boolean(item.classification_snapshot.qa_checked_at))
    ).length,
    qualified: items.filter((item) => item.bucket === 'qualified').length,
    review: included.filter((item) => item.classification_snapshot.editorial_review_state === 'pendente').length,
    annex: items.filter((item) => item.bucket === 'annex').length,
    excluded: items.filter((item) => item.bucket === 'excluded').length,
  }
}

function normalizedSourceVerification(item: ReportEvidenceItem): SourceVerificationStatus {
  const value = item.classification_snapshot.source_verification_status
  return value === 'fonte_original' ||
    value === 'documento_integral' ||
    value === 'parcial' ||
    value === 'nao_verificada'
    ? value
    : 'nao_verificada'
}

export function evidenceCitations(items: ReportEvidenceItem[]): EvidenceCitation[] {
  return items
    .filter((item) => item.bucket === 'qualified')
    .sort((a, b) => a.position - b.position)
    .map((item, index) => ({
      code: `E${String(index + 1).padStart(3, '0')}`,
      article_id: item.article_id,
      title: item.article_snapshot.title,
      publisher:
        item.article_snapshot.publisher ||
        item.article_snapshot.source_name ||
        'Veículo não identificado',
      published_at: item.article_snapshot.published_at,
      source_verification_status: normalizedSourceVerification(item),
    }))
}

export function buildMethodologySnapshot(items: ReportEvidenceItem[]): MethodologySnapshot {
  const sourceStatuses = items.map(normalizedSourceVerification)
  return {
    monitored_total: items.length,
    direct_mentions: items.filter(
      (item) => item.bucket !== 'excluded' && item.classification_snapshot.cita_cliente === true
    ).length,
    qualified_evidence: items.filter((item) => item.bucket === 'qualified').length,
    annex_total: items.filter((item) => item.bucket === 'annex').length,
    excluded_total: items.filter((item) => item.bucket === 'excluded').length,
    content_integral: items.filter((item) => item.article_snapshot.content_status === 'integral').length,
    content_partial: items.filter((item) => item.article_snapshot.content_status === 'parcial').length,
    content_metadata_only: items.filter(
      (item) => item.article_snapshot.content_status === 'metadados'
    ).length,
    source_original_verified: sourceStatuses.filter((status) => status === 'fonte_original').length,
    source_document_integral: sourceStatuses.filter((status) => status === 'documento_integral').length,
    source_partial: sourceStatuses.filter((status) => status === 'parcial').length,
    source_unverified: sourceStatuses.filter((status) => status === 'nao_verificada').length,
    generated_at: new Date().toISOString(),
  }
}

export function buildMethodologyNote(
  snapshot: MethodologySnapshot,
  clientName: string,
  editorial?: AppliedEditorialSnapshot | null
) {
  const directMentions = metricVisibility(editorial, 'mencoes-diretas') === 'publica'
    ? `Foram identificadas **${snapshot.direct_mentions} menções diretas a ${clientName}**. As demais ocorrências qualificadas são inteligência setorial: ajudam a interpretar riscos e oportunidades, mas não equivalem a exposição nominal do cliente.`
    : `O universo combina inteligência setorial e inserções específicas sobre ${clientName}, permitindo interpretar riscos, oportunidades e movimentos do ambiente sem reduzir a análise à exposição nominal da entidade.`
  return [
    '## NOTA DE MÉTODO',
    '',
    `O universo desta competência reúne **${snapshot.monitored_total} ocorrências monitoradas no servidor**, sem limitação aos itens carregados na interface. Após triagem e verificação editorial, **${snapshot.qualified_evidence}** compõem a Base Qualificada e **${snapshot.annex_total}** permanecem no Anexo Monitorado.`,
    '',
    directMentions,
    '',
    `Quanto ao conteúdo disponível, há **${snapshot.content_integral} textos integrais**, **${snapshot.content_partial} conteúdos parciais** e **${snapshot.content_metadata_only} registros somente com metadados.** Quanto à conferência da origem, **${snapshot.source_original_verified} fontes originais** foram verificadas, **${snapshot.source_document_integral} documentos integrais** foram preservados, **${snapshot.source_partial} fontes** permanecem parciais e **${snapshot.source_unverified}** não tiveram a origem diretamente conferida.`,
    '',
    '_“Fonte verificada” descreve a conferência da publicação de origem; não representa validação independente de toda afirmação feita pelo veículo._',
  ].join('\n')
}

function tableValue(value: unknown) {
  return String(value ?? '—')
    .replace(/\|/g, '\\|')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildThematicMatrix(topics: MonthlyReportTopic[], items: ReportEvidenceItem[]) {
  const qualified = new Map(
    items.filter((item) => item.bucket === 'qualified').map((item) => [item.article_id, item])
  )
  const rows = [...topics]
    .sort((a, b) => a.position - b.position)
    .map((topic) => {
      const linked = (topic.evidence || [])
        .map((link) => qualified.get(link.article_id))
        .filter((item): item is ReportEvidenceItem => Boolean(item))
      const verified = linked.filter((item) =>
        ['fonte_original', 'documento_integral'].includes(normalizedSourceVerification(item))
      ).length
      const tones = Array.from(
        new Set(linked.map((item) => item.classification_snapshot.tom).filter(Boolean))
      ).join(', ')
      const scopes = Array.from(
        new Set(linked.map((item) => item.classification_snapshot.geographic_scope).filter(Boolean))
      ).join(', ')
      const signal =
        topic.coverage_status === 'covered'
          ? 'Cobertura confirmada'
          : topic.coverage_status === 'gap'
            ? 'Lacuna reconhecida'
            : 'Em revisão'
      return `| ${tableValue(topic.title)} | ${linked.length} | ${verified} | ${tableValue(tones)} | ${tableValue(scopes)} | ${signal} |`
    })
  return [
    '### Matriz temática verificada',
    '',
    '| Pauta | Evidências | Fontes conferidas | Tom | Geografia | Sinal do mês |',
    '|---|---:|---:|---|---|---|',
    ...rows,
  ].join('\n')
}

function markdownParagraphs(content: string) {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function isInterpretiveParagraph(paragraph: string) {
  return /^\*\*(?:Leitura estratégica|Interpretação estratégica|Recomendação|Resposta recomendada):\*\*/i.test(
    paragraph
  )
}

function isFactualParagraph(paragraph: string, sectionKey: number) {
  if (/^#{1,6}\s/.test(paragraph) || /^\|[\s:|-]+\|?$/.test(paragraph)) return false
  if (/^\*\*[^*\n]+\*\*$/.test(paragraph) || isInterpretiveParagraph(paragraph)) return false
  // Nas seções analíticas centrais, a ausência de um marcador explícito de
  // interpretação significa que o parágrafo está apresentando evidência.
  if (sectionKey <= 6) return true
  return /(?:\d|%|R\$|segundo|de acordo|publicou|informou|registrou|apontou|anunciou|afirmou|declarou|dados|levantamento|pesquisa|no mês|em julho|durante o período|sinal do mês)/i.test(
    paragraph
  )
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function auditReportTraceability(input: {
  sections: ReportSection[]
  citations: EvidenceCitation[]
  posture: ReportPosture
  clientName: string
}): ReportQualityCheckItem[] {
  const validCodes = new Set(input.citations.map((citation) => citation.code))
  const invalid: string[] = []
  const uncited: string[] = []
  const sourceClaims: string[] = []
  const postureViolations: string[] = []
  const clientPattern = new RegExp(
    `\\b(?:${escapeRegex(input.clientName)}|cliente|organização)\\s+(?:deve|precisa|deverá|tem de)\\b`,
    'i'
  )

  for (const section of input.sections.filter(
    (candidate) => candidate.section_key >= 1 && candidate.section_key <= 8 && candidate.content.trim()
  )) {
    for (const paragraph of markdownParagraphs(section.content)) {
      const codes = Array.from(paragraph.matchAll(/\[(E\d{3})\]/g), (match) => match[1])
      for (const code of codes) {
        if (!validCodes.has(code)) invalid.push(`Seção ${section.section_key}: [${code}]`)
      }
      if (isFactualParagraph(paragraph, section.section_key) && !codes.length) {
        uncited.push(`Seção ${section.section_key}: ${paragraph.slice(0, 140)}`)
      }
      if (/todas as fontes (?:foram |estão )?verificadas|fontes integralmente verificadas/i.test(paragraph)) {
        sourceClaims.push(`Seção ${section.section_key}: ${paragraph.slice(0, 140)}`)
      }
      if (input.posture === 'consultivo_cauteloso' && clientPattern.test(paragraph)) {
        postureViolations.push(`Seção ${section.section_key}: ${paragraph.slice(0, 140)}`)
      }
      if (
        input.posture === 'consultivo_cauteloso' &&
        /^-\s+(?:liderar|criar|estruturar|definir|posicionar|consolidar|ampliar|produzir|lançar|articular)\b/im.test(
          paragraph
        )
      ) {
        postureViolations.push(`Seção ${section.section_key}: ${paragraph.slice(0, 140)}`)
      }
    }
  }

  return [
    check('citation_validity', 'Todas as citações apontam para evidências qualificadas', invalid.length, invalid),
    check('factual_traceability', 'Afirmações factuais possuem citação de evidência', uncited.length, uncited),
    check(
      'source_claim_consistency',
      'O texto não generaliza a verificação das fontes',
      sourceClaims.length,
      sourceClaims
    ),
    check(
      'narrative_posture',
      'A linguagem respeita a postura narrativa escolhida',
      postureViolations.length,
      postureViolations
    ),
  ]
}

function duplicateKey(item: ReportEvidenceItem) {
  const article = item.article_snapshot
  return [
    normalizeText(article.publisher || article.source_name || ''),
    normalizeText(article.title),
    article.published_at?.slice(0, 10) || '',
  ].join('|')
}

function check(
  key: string,
  label: string,
  count: number,
  details: string[] = [],
  status: ReportQualityCheckItem['status'] = count ? 'blocked' : 'passed'
): ReportQualityCheckItem {
  return { key, label, status: count ? status : 'passed', count, details: details.slice(0, 20) }
}

/**
 * Lint estrutural das cinco seções cuja FORMA foi ditada no prompt (§1, 2, 5, 7, 8).
 *
 * Sem isto, a forma é só um pedido: o modelo entrega prosa quando pedimos tabela,
 * três cenários quando pedimos quatro, e ninguém percebe até o PDF. O parser de
 * `report-structure.ts` lê exatamente este formato — o que o lint não travar aqui
 * vira campo vazio no JSON entregue ao design.
 *
 * ATENÇÃO: confere POR LINHA, não por parágrafo. `markdownParagraphs` divide em
 * linha em branco, então uma tabela inteira é UM parágrafo e um único [E###] em
 * qualquer célula faria a checagem passar para todas as linhas.
 */
export function auditReportStructure(sections: ReportSection[]): ReportQualityCheckItem[] {
  const byKey = new Map(sections.map((section) => [section.section_key, section.content || '']))
  const lines = (key: number) =>
    (byKey.get(key) || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  const problems: string[] = []

  // Seção 1 — número do mês e insights em duas partes.
  const s1 = lines(1)
  if (s1.length) {
    if (!s1.some((line) => /^#{2,4}\s*O NÚMERO DO MÊS/i.test(line))) {
      problems.push('Seção 1: falta o bloco "### O NÚMERO DO MÊS"')
    }
    const insights = s1.filter((line) => /^\d+\.\s+\*\*/.test(line))
    if (insights.length < 7 || insights.length > 8) {
      problems.push(`Seção 1: ${insights.length} insights com tese em negrito (esperado 7 ou 8)`)
    }
  }

  // Seção 2 — tabela de três colunas, cada linha datada e citada.
  const s2 = lines(2)
  if (s2.length) {
    const rows = s2.filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(line))
    const header = rows[0] || ''
    if (!/RELEV\./i.test(header) || !/SINAL DO MÊS/i.test(header)) {
      problems.push('Seção 2: falta a tabela com as colunas TEMA ESTRATÉGICO | RELEV. | SINAL DO MÊS')
    }
    const body = rows.slice(1)
    if (body.length < 5) problems.push(`Seção 2: tabela com ${body.length} linhas (mínimo 5)`)
    for (const row of body) {
      const cells = row.split('|').map((cell) => cell.trim()).filter(Boolean)
      if (cells.length < 3) {
        problems.push(`Seção 2: linha com ${cells.length} colunas — ${row.slice(0, 90)}`)
        continue
      }
      if (!/^(Alta|Média)$/i.test(cells[1])) {
        problems.push(`Seção 2: RELEV. "${cells[1]}" fora da escada Alta/Média`)
      }
      if (!/\[E\d{3}\]/.test(cells[2])) {
        problems.push(`Seção 2: SINAL DO MÊS sem citação — ${cells[2].slice(0, 90)}`)
      }
      if (!/\d{1,2}\/\d{1,2}|\d{1,2}\s+de\s+[a-zçãé]+/i.test(cells[2])) {
        problems.push(`Seção 2: SINAL DO MÊS sem data — ${cells[2].slice(0, 90)}`)
      }
    }
  }

  // Seção 5 — escadas fechadas e nenhum par repetido.
  const s5 = lines(5)
  if (s5.length) {
    const probs = s5.filter((line) => /^Probabilidade:/i.test(line))
    const impacts = s5.filter((line) => /^Impacto:/i.test(line))
    if (probs.length < 4) problems.push(`Seção 5: ${probs.length} riscos com Probabilidade (mínimo 4)`)
    if (probs.length !== impacts.length) {
      problems.push(`Seção 5: ${probs.length} linhas de Probabilidade para ${impacts.length} de Impacto`)
    }
    const value = (line: string) => line.split(':').slice(1).join(':').trim()
    for (const line of probs) {
      if (!/^(Média|Média-alta|Alta)$/i.test(value(line))) {
        problems.push(`Seção 5: Probabilidade "${value(line)}" fora da escada Média/Média-alta/Alta`)
      }
    }
    for (const line of impacts) {
      if (!/^(Médio|Alto|Muito alto)$/i.test(value(line))) {
        problems.push(`Seção 5: Impacto "${value(line)}" fora da escada Médio/Alto/Muito alto`)
      }
    }
    // Pares repetidos ficam sobrepostos na matriz de risco do design.
    const pairs = probs
      .slice(0, impacts.length)
      .map((line, index) => `${value(line).toLowerCase()}|${value(impacts[index]).toLowerCase()}`)
    const repeated = pairs.filter((pair, index) => pairs.indexOf(pair) !== index)
    for (const pair of Array.from(new Set(repeated))) {
      problems.push(`Seção 5: dois riscos com o mesmo par probabilidade+impacto (${pair.replace('|', ' / ')})`)
    }
    if (!s5.some((line) => /^Sinal do mês\s*—/i.test(line))) {
      problems.push('Seção 5: nenhum risco traz a linha "Sinal do mês —"')
    }
  }

  // Seção 7 — os três horizontes, sem inventar um quarto.
  const s7 = lines(7)
  if (s7.length) {
    const expected = [/AÇÕES IMEDIATAS/i, /AÇÕES DE CURTO PRAZO/i, /AÇÕES DE MÉDIO PRAZO/i]
    const headings = s7.filter((line) => /^###\s/.test(line))
    for (const [index, pattern] of expected.entries()) {
      if (!pattern.test(headings[index] || '')) {
        problems.push(`Seção 7: bloco ${index + 1} não é o esperado (${headings[index] || 'ausente'})`)
      }
    }
    if (headings.length !== 3) problems.push(`Seção 7: ${headings.length} blocos de prazo (esperado exatamente 3)`)
  }

  // Seção 8 — exatamente CENÁRIO 01..04, cada um com resposta.
  const s8 = lines(8)
  if (s8.length) {
    const labels = s8
      .map((line) => line.match(/CENÁRIO\s+(\d{2})/i))
      .filter(Boolean)
      .map((match) => (match as RegExpMatchArray)[1])
    const unique = Array.from(new Set(labels))
    if (unique.join(',') !== '01,02,03,04') {
      problems.push(`Seção 8: cenários encontrados [${unique.join(', ') || 'nenhum'}] (esperado 01, 02, 03, 04)`)
    }
    const answers = s8.filter((line) => /^\*\*Resposta recomendada:\*\*/i.test(line)).length
    if (answers !== 4) problems.push(`Seção 8: ${answers} "Resposta recomendada:" (esperado 4)`)
  }

  return [check('report_structure', 'As seções seguem o formato do relatório-modelo', problems.length, problems)]
}

export function evaluateReportQuality(input: {
  items: ReportEvidenceItem[]
  topics: MonthlyReportTopic[]
  sections: ReportSection[]
  leadArticleId: string | null
  periodMonth: string
  assignedArticleIds?: Set<string>
  narrativePosture?: ReportPosture
  clientName?: string
  editorialSnapshot?: AppliedEditorialSnapshot | null
}): { status: 'passed' | 'blocked'; checks: ReportQualityCheckItem[]; funnel: QualificationFunnel } {
  const { items, topics, sections, leadArticleId, periodMonth } = input
  const assigned = input.assignedArticleIds || new Set<string>()
  const included = items.filter((item) => item.bucket !== 'excluded')
  const qualified = items.filter((item) => item.bucket === 'qualified')
  const { start, end } = reportMonthBounds(periodMonth.slice(0, 7))
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const untriaged = included.filter(
    (item) =>
      !item.classification_snapshot.triaged_at &&
      item.classification_snapshot.report_role_source !== 'humano'
  )
  const unverifiedEvidence = included.filter((item) => {
    const classification = item.classification_snapshot
    if (classification.report_role !== 'evidencia') return false
    if (item.bucket !== 'qualified') return true
    return (
      classification.editorial_review_state !== 'revisado' &&
      (classification.verification_status !== 'verificada' ||
        !classification.qa_checked_at ||
        Number(classification.editorial_confidence || 0) < 0.85)
    )
  })
  const exceptionPending = included.filter((item) => {
    const classification = item.classification_snapshot
    const exception =
      classification.cita_cliente === true ||
      classification.tom === 'negativo' ||
      classification.tom === 'critico' ||
      (Array.isArray(classification.quality_flags) &&
        (classification.quality_flags as string[]).includes('agenda_obrigatoria'))
    return exception && classification.editorial_review_state !== 'revisado'
  })
  const outsidePeriod = included.filter((item) => {
    if (assigned.has(item.article_id)) return false
    const published = item.article_snapshot.published_at
    if (!published) return true
    const time = new Date(published).getTime()
    return !Number.isFinite(time) || time < startMs || time >= endMs
  })
  const duplicateGroups = new Map<string, ReportEvidenceItem[]>()
  for (const item of qualified) {
    const key = duplicateKey(item)
    const rows = duplicateGroups.get(key) || []
    rows.push(item)
    duplicateGroups.set(key, rows)
  }
  const exactDuplicates = Array.from(duplicateGroups.values()).filter((rows) => rows.length > 1)
  const uncoveredTopics = topics.filter(
    (topic) =>
      topic.required &&
      !(
        (topic.coverage_status === 'covered' && Number(topic.evidence_count || 0) > 0) ||
        (topic.coverage_status === 'gap' && topic.gap_acknowledged_at)
      )
  )
  const staleSections = sections.filter((section) => section.status === 'stale' || section.status === 'error')

  const checks = [
    check('agenda_exists', 'Agenda mensal definida', topics.length ? 0 : 1),
    check(
      'triage_complete',
      'Todas as candidatas receberam papel editorial',
      untriaged.length,
      untriaged.map((item) => item.article_snapshot.title)
    ),
    check(
      'qualified_verified',
      'Evidências verificadas ou revisadas por pessoa',
      unverifiedEvidence.length,
      unverifiedEvidence.map((item) => item.article_snapshot.title)
    ),
    check(
      'exceptions_reviewed',
      'Menções diretas, negativas, críticas e agenda revisadas',
      exceptionPending.length,
      exceptionPending.map((item) => item.article_snapshot.title)
    ),
    check(
      'period_consistent',
      'Base sem mistura indevida de competências',
      outsidePeriod.length,
      outsidePeriod.map((item) => item.article_snapshot.title)
    ),
    check('lead_selected', 'Matéria principal selecionada', leadArticleId ? 0 : 1),
    check(
      'sections_current',
      'Seções atualizadas em relação à base',
      staleSections.length,
      staleSections.map((section) => `Seção ${section.section_key}`),
      'warning'
    ),
    check(
      'required_topics',
      'Tópicos obrigatórios cobertos ou lacunas reconhecidas',
      uncoveredTopics.length,
      uncoveredTopics.map((topic) => topic.title)
    ),
    check(
      'no_exact_duplicates',
      'Sem duplicata exata na Base Qualificada',
      exactDuplicates.reduce((sum, rows) => sum + rows.length - 1, 0),
      exactDuplicates.map((rows) => rows[0].article_snapshot.title)
    ),
    ...auditReportTraceability({
      sections,
      citations: evidenceCitations(items),
      posture: input.narrativePosture || 'consultivo_cauteloso',
      clientName: input.clientName || 'cliente',
    }),
    ...auditReportStructure(sections),
    ...lintEditorialDirectives(
      sections
        .filter((section) => section.content.trim())
        .map((section) => section.content)
        .join('\n\n'),
      input.editorialSnapshot
    ),
  ]
  return {
    status: checks.some((item) => item.status === 'blocked') ? 'blocked' : 'passed',
    checks,
    funnel: qualificationFunnel(items),
  }
}

export function buildAgendaSection(topics: MonthlyReportTopic[]) {
  const rows = [...topics].sort((a, b) => a.position - b.position)
  return [
    '# AGENDA EDITORIAL INTERNA E LACUNAS',
    '',
    ...rows.flatMap((topic) => [
      `## ${topic.position}. ${topic.title}`,
      '',
      topic.coverage_status === 'covered'
        ? `**Cobertura:** confirmada em ${topic.evidence_count || topic.evidence?.length || 0} publicação(ões).`
        : `**Cobertura:** lacuna monitorada${topic.gap_reason ? ` — ${topic.gap_reason}` : '.'}`,
      topic.rationale ? `**Justificativa editorial:** ${topic.rationale}` : '',
      '',
    ]),
  ]
    .filter((line) => line !== '')
    .join('\n\n')
}
