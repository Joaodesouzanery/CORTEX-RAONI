import { createHash } from 'node:crypto'
import type {
  ApprovalChecklist,
  LeadSuggestion,
  MonthlyReportDraft,
  PeriodComparison,
  ReportCluster,
  ReportEvidenceItem,
  ReportRole,
  ReportSection,
} from '@/types'
import { normalizeText } from '@/lib/relevance'

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)])
    )
  }
  return value
}

function digestItem(item: Pick<ReportEvidenceItem, 'article_id' | 'bucket' | 'article_snapshot' | 'classification_snapshot'>) {
  const classification = item.classification_snapshot
  return {
    article_id: item.article_id,
    bucket: item.bucket,
    article: {
      title: item.article_snapshot.title,
      published_at: item.article_snapshot.published_at,
      publisher: item.article_snapshot.publisher,
      content_status: item.article_snapshot.content_status,
      content_hash: createHash('sha1')
        .update(item.article_snapshot.content || item.article_snapshot.excerpt || '')
        .digest('hex'),
    },
    classification: {
      tom: classification.tom,
      relevancia: classification.relevancia,
      cita_cliente: classification.cita_cliente,
      tema: classification.tema,
      report_role: classification.report_role,
      editorial_review_state: classification.editorial_review_state,
      verification_status: classification.verification_status,
      source_verification_status: classification.source_verification_status,
      editorial_confidence: classification.editorial_confidence,
      geographic_scope: classification.geographic_scope,
      quality_flags: classification.quality_flags,
      manual_intake: classification.manual_intake,
    },
  }
}

export function reportBaseDigest(items: Array<Pick<ReportEvidenceItem, 'article_id' | 'bucket' | 'article_snapshot' | 'classification_snapshot'>>) {
  const payload = items.map(digestItem).sort((a, b) => a.article_id.localeCompare(b.article_id))
  return createHash('sha256').update(JSON.stringify(stable(payload))).digest('hex')
}

export function diffReportBase(previous: ReportEvidenceItem[], current: ReportEvidenceItem[]) {
  const oldById = new Map(previous.map((item) => [item.article_id, item]))
  const newById = new Map(current.map((item) => [item.article_id, item]))
  const added = current
    .filter((item) => !oldById.has(item.article_id))
    .map((item) => ({ article_id: item.article_id, title: item.article_snapshot.title, bucket: item.bucket }))
  const removed = previous
    .filter((item) => !newById.has(item.article_id))
    .map((item) => ({ article_id: item.article_id, title: item.article_snapshot.title, bucket: item.bucket }))
  const bucketChanges: Array<Record<string, unknown>> = []
  const reclassified: Array<Record<string, unknown>> = []
  const contentChanged: Array<Record<string, unknown>> = []
  for (const item of current) {
    const old = oldById.get(item.article_id)
    if (!old) continue
    if (old.bucket !== item.bucket) {
      bucketChanges.push({ article_id: item.article_id, title: item.article_snapshot.title, from: old.bucket, to: item.bucket })
    }
    const oldDigest = JSON.stringify(stable(digestItem(old).classification))
    const newDigest = JSON.stringify(stable(digestItem(item).classification))
    if (oldDigest !== newDigest) {
      reclassified.push({ article_id: item.article_id, title: item.article_snapshot.title })
    }
    const oldArticleDigest = JSON.stringify(stable(digestItem(old).article))
    const newArticleDigest = JSON.stringify(stable(digestItem(item).article))
    if (oldArticleDigest !== newArticleDigest) {
      contentChanged.push({ article_id: item.article_id, title: item.article_snapshot.title })
    }
  }
  return { added, removed, reclassified, content_changed: contentChanged, bucket_changes: bucketChanges }
}

const STOP = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'para', 'com', 'por', 'um', 'uma', 'no', 'na', 'nos', 'nas'])
function titleTokens(title: string) {
  return normalizeText(title)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP.has(token))
}

function jaccard(a: string[], b: string[]) {
  const left = new Set(a)
  const right = new Set(b)
  const intersection = [...left].filter((token) => right.has(token)).length
  const union = new Set([...left, ...right]).size
  return union ? intersection / union : 0
}

function daysApart(a: string | null, b: string | null) {
  if (!a || !b) return 0
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000
}

export function buildReportClusters(draftId: string, items: ReportEvidenceItem[]): ReportCluster[] {
  const groups: Array<{ representative: ReportEvidenceItem; tokens: string[]; items: ReportEvidenceItem[] }> = []
  for (const item of [...items].sort((a, b) => (b.article_snapshot.published_at || '').localeCompare(a.article_snapshot.published_at || ''))) {
    const tokens = titleTokens(item.article_snapshot.title)
    const match = groups.find(
      (group) =>
        daysApart(group.representative.article_snapshot.published_at, item.article_snapshot.published_at) <= 7 &&
        (jaccard(group.tokens, tokens) >= 0.42 || tokens.filter((token) => group.tokens.includes(token)).length >= 4)
    )
    if (match) match.items.push(item)
    else groups.push({ representative: item, tokens, items: [item] })
  }
  return groups.map((group) => {
    const representative = [...group.items].sort((a, b) => {
      const direct = Number(b.classification_snapshot.cita_cliente === true) - Number(a.classification_snapshot.cita_cliente === true)
      if (direct) return direct
      return Number(b.classification_snapshot.editorial_score || 0) - Number(a.classification_snapshot.editorial_score || 0)
    })[0]
    const roles = group.items.map((item) => item.classification_snapshot.report_role).filter(Boolean) as ReportRole[]
    const suggestedRole: ReportRole = roles.includes('evidencia') ? 'evidencia' : roles.includes('contexto') ? 'contexto' : 'ruido'
    const normalized = normalizeText(representative.article_snapshot.title).slice(0, 120)
    const key = createHash('sha1').update(normalized).digest('hex').slice(0, 20)
    const vehicles = new Set(group.items.map((item) => item.article_snapshot.publisher || item.article_snapshot.source_name).filter(Boolean))
    const confidences = group.items.map((item) => Number(item.classification_snapshot.editorial_confidence || 0)).filter(Boolean)
    return {
      draft_id: draftId,
      cluster_key: key,
      label: representative.article_snapshot.title,
      representative_article_id: representative.article_id,
      article_count: group.items.length,
      vehicle_count: vehicles.size,
      direct_mentions: group.items.filter((item) => item.classification_snapshot.cita_cliente === true).length,
      tone: (representative.classification_snapshot.tom as ReportCluster['tone']) || null,
      confidence: confidences.length ? Math.max(...confidences) : null,
      suggested_role: suggestedRole,
      suggestion_reason: `${group.items.length} publicação(ões), ${vehicles.size} veículo(s); representante escolhido por menção direta e pontuação editorial.`,
      human_role: null,
      human_label: null,
      human_decided_at: null,
      article_ids: group.items.map((item) => item.article_id),
    }
  })
}

export function exceptionPriority(item: ReportEvidenceItem, requiredTopicArticleIds = new Set<string>()) {
  const classification = item.classification_snapshot
  if (
    classification.manual_intake === true ||
    classification.cita_cliente === true ||
    ['negativo', 'critico'].includes(String(classification.tom)) ||
    requiredTopicArticleIds.has(item.article_id)
  ) return 1
  if (
    classification.report_role === 'evidencia' ||
    item.article_snapshot.content_status !== 'integral' ||
    classification.source_verification_status === 'nao_verificada' ||
    (classification.quality_flags as string[] | undefined)?.includes('divergencia_de_classificacao')
  ) return 2
  if (Number(classification.editorial_confidence || 0) < 0.7) return 3
  return null
}

export function leadSuggestions(draftId: string, baseVersion: number, items: ReportEvidenceItem[], clusters: ReportCluster[]): LeadSuggestion[] {
  const clusterByArticle = new Map<string, ReportCluster>()
  for (const cluster of clusters) for (const articleId of cluster.article_ids) clusterByArticle.set(articleId, cluster)
  return items
    .filter((item) => item.bucket === 'qualified')
    .map((item) => {
      const classification = item.classification_snapshot
      const cluster = clusterByArticle.get(item.article_id)
      let score = Number(classification.editorial_score || 0)
      const reasons: string[] = []
      if (classification.cita_cliente === true) { score += 30; reasons.push('menção direta') }
      if (classification.relevancia === 'alta') { score += 15; reasons.push('alta relevância') }
      if (item.article_snapshot.content_status === 'integral') { score += 10; reasons.push('texto integral') }
      if (classification.source_verification_status === 'fonte_original') { score += 10; reasons.push('fonte original verificada') }
      if (cluster) { score += Math.min(15, Math.max(0, cluster.vehicle_count - 1) * 3); reasons.push(`${cluster.vehicle_count} veículo(s) na pauta`) }
      return { draft_id: draftId, base_version: baseVersion, article_id: item.article_id, rank: 0, score, rationale: reasons.join(' · ') || 'melhor pontuação editorial disponível', snapshot: { article: item.article_snapshot, classification, cluster_key: cluster?.cluster_key } }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function metricSet(items: ReportEvidenceItem[], key: 'tema' | 'publisher') {
  return new Set(
    items
      .filter((item) => item.bucket !== 'excluded')
      .map((item) => key === 'tema' ? item.classification_snapshot.tema : item.article_snapshot.publisher || item.article_snapshot.source_name)
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
  )
}

export function comparePeriods(currentPeriod: string, current: ReportEvidenceItem[], previousPeriod: string | null, previous: ReportEvidenceItem[]): PeriodComparison {
  const currentThemes = metricSet(current, 'tema')
  const previousThemes = metricSet(previous, 'tema')
  const currentSources = metricSet(current, 'publisher')
  const previousSources = metricSet(previous, 'publisher')
  return {
    current_period: currentPeriod,
    previous_period: previousPeriod,
    current_total: current.filter((item) => item.bucket !== 'excluded').length,
    previous_total: previous.filter((item) => item.bucket !== 'excluded').length,
    current_qualified: current.filter((item) => item.bucket === 'qualified').length,
    previous_qualified: previous.filter((item) => item.bucket === 'qualified').length,
    current_direct_mentions: current.filter((item) => item.bucket !== 'excluded' && item.classification_snapshot.cita_cliente === true).length,
    previous_direct_mentions: previous.filter((item) => item.bucket !== 'excluded' && item.classification_snapshot.cita_cliente === true).length,
    themes_new: [...currentThemes].filter((item) => !previousThemes.has(item)).sort(),
    themes_recurring: [...currentThemes].filter((item) => previousThemes.has(item)).sort(),
    themes_absent: [...previousThemes].filter((item) => !currentThemes.has(item)).sort(),
    sources_new: [...currentSources].filter((item) => !previousSources.has(item)).sort(),
    generated_at: new Date().toISOString(),
  }
}

export function approvalChecklist(input: {
  draft: MonthlyReportDraft
  items: ReportEvidenceItem[]
  sections: ReportSection[]
  unresolvedExceptions: number
  uncoveredRequiredTopics: number
  invalidCitations: number
  comparisonReady: boolean
  packageCurrent?: boolean
  requirePackage?: boolean
  qualifiedCount?: number
  unverifiedQualified?: number
  placeholders?: number
  serviceMetricsReady?: boolean
  qualityReady?: boolean
}): ApprovalChecklist {
  const untriaged = input.items.filter((item) => item.bucket !== 'excluded' && !item.classification_snapshot.triaged_at && item.classification_snapshot.report_role_source !== 'humano').length
  const incompleteSections = input.sections.length !== 9 || input.sections.some(
    (section) => !String(section.content || '').trim() || ['pending', 'stale', 'error'].includes(section.status)
  )
  const items: ApprovalChecklist['items'] = [
    { key: 'base', label: 'Base atualizada', status: input.draft.base_digest ? 'passed' : 'blocked' },
    { key: 'triage', label: 'Triagem completa', status: untriaged ? 'blocked' : 'passed', detail: untriaged ? `${untriaged} item(ns) sem triagem` : undefined },
    { key: 'evidence', label: 'Base qualificada com evidências verificadas', status: !input.qualifiedCount || input.unverifiedQualified ? 'blocked' : 'passed', detail: !input.qualifiedCount ? 'Nenhuma evidência qualificada' : input.unverifiedQualified ? `${input.unverifiedQualified} evidência(s) sem verificação` : undefined },
    { key: 'exceptions', label: 'Exceções resolvidas', status: input.unresolvedExceptions ? 'blocked' : 'passed', detail: input.unresolvedExceptions ? `${input.unresolvedExceptions} pendência(s)` : undefined },
    { key: 'agenda', label: 'Agenda coberta ou lacunas reconhecidas', status: input.uncoveredRequiredTopics ? 'blocked' : 'passed' },
    { key: 'lead', label: 'Matéria principal escolhida', status: input.draft.lead_article_id ? 'passed' : 'blocked' },
    { key: 'comparison', label: 'Comparação mensal produzida', status: input.comparisonReady ? 'passed' : 'blocked' },
    { key: 'sections', label: 'Seções 1–9 completas e atuais', status: incompleteSections ? 'blocked' : 'passed', detail: incompleteSections ? `${input.sections.length} de 9 seção(ões) persistidas; revise conteúdo vazio ou desatualizado` : undefined },
    { key: 'placeholders', label: 'Sem campos pendentes no texto', status: input.placeholders ? 'blocked' : 'passed', detail: input.placeholders ? `${input.placeholders} placeholder(s) como [A PREENCHER]` : undefined },
    { key: 'service_metrics', label: 'Indicadores de serviço confirmados', status: input.serviceMetricsReady ? 'passed' : 'blocked' },
    { key: 'quality', label: 'Portões de qualidade executados na base atual', status: input.qualityReady ? 'passed' : 'blocked' },
    { key: 'citations', label: 'Citações válidas', status: input.invalidCitations ? 'blocked' : 'passed' },
    ...(input.requirePackage === false
      ? []
      : [{ key: 'package', label: 'Pacote final para o Claude disponível', status: (input.packageCurrent ?? (input.draft.final_package_base_version === input.draft.base_version)) ? 'passed' as const : 'blocked' as const }]),
  ]
  return { base_version: input.draft.base_version, generated_at: new Date().toISOString(), ready: items.every((item) => item.status !== 'blocked'), items }
}
