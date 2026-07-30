import type {
  ArticleSnapshot,
  GeographicScope,
  MonthlyReportTopic,
  QualificationFunnel,
  QualityFlag,
  ReportEvidenceItem,
  ReportQualityCheckItem,
  ReportSection,
} from '@/types'
import { normalizeText } from '@/lib/relevance'

const PARA_TERMS =
  /\b(para|carajas|belem|parauapebas|maraba|canaa dos carajas|oriximina|juruti|trombetas|barcarena)\b/
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
  if (PARA_TERMS.test(text)) return 'para'
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
  if (scope === 'internacional' && !/\b(brasil|para|amazonia|carajas|cadeia brasileira|setor brasileiro)\b/.test(text)) {
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

export function evaluateReportQuality(input: {
  items: ReportEvidenceItem[]
  topics: MonthlyReportTopic[]
  sections: ReportSection[]
  leadArticleId: string | null
  periodMonth: string
  assignedArticleIds?: Set<string>
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
    '## 10. AGENDA MENSAL E TEMAS OBRIGATÓRIOS',
    '',
    ...rows.flatMap((topic) => [
      `### 10.${topic.position}. ${topic.title}`,
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
