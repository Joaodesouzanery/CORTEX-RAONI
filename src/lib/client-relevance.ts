import type {
  Article,
  ArticleTag,
  Client,
  ClientRelevanceRule,
  MatchReason,
  MonitoringStatus,
  Relevancia,
} from '@/types'
import { matchKeyword, normalizeText, parseKeywords } from '@/lib/relevance'

export interface RelevanceEvaluation {
  monitoring_status: MonitoringStatus
  match_score: number
  match_reasons: MatchReason[]
  rule_version: number
  confidence: number
  cita_cliente: boolean
  relevancia: Relevancia
  tema: string | null
}

function articleText(article: Pick<Article, 'title' | 'excerpt' | 'content'>): { raw: string; normalized: string } {
  const raw = [article.title, article.excerpt, article.content].filter(Boolean).join(' ')
  return { raw, normalized: normalizeText(raw) }
}

function matchingTerms(terms: string[], normalized: string, raw = ''): string[] {
  const matched: string[] = []
  for (const term of parseKeywords(terms)) {
    // Normalization intentionally erases case. Acronyms need an additional
    // case-sensitive guard so ONS never matches the stock-market plural "ONs"
    // and ANM never matches an ordinary lowercase word.
    const acronymMatch =
      term.kind !== 'acronym' ||
      new RegExp(`(?:^|[^A-Za-z0-9])${term.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^A-Za-z0-9])`).test(raw)
    if (acronymMatch && matchKeyword(term, normalized)) matched.push(term.raw)
  }
  return matched
}

function ruleMatches(rule: ClientRelevanceRule, normalized: string, raw: string): string[] | null {
  if (matchingTerms(rule.excluded_terms || [], normalized, raw).length) return null
  const groups = Array.isArray(rule.required_groups) ? rule.required_groups : []
  if (!groups.length) return null
  const allMatches: string[] = []
  for (const group of groups) {
    const matches = matchingTerms(group, normalized, raw)
    if (!matches.length) return null
    allMatches.push(...matches)
  }
  return Array.from(new Set(allMatches))
}

function isDaqRoadFalsePositive(client: Client, normalized: string): boolean {
  if (!client.name.startsWith('DAQ')) return false
  const road = matchingTerms(['rodovia', 'pavimentação', 'viaduto', 'ponte rodoviária', 'BR-'], normalized).length > 0
  const water =
    matchingTerms(
      ['hidrovia', 'dragagem', 'eclusa', 'navegação interior', 'aquaviário', 'porto fluvial', 'canal de navegação'],
      normalized
    ).length > 0
  return road && !water
}

export function evaluateClientArticle(
  client: Client,
  rules: ClientRelevanceRule[],
  article: Pick<Article, 'title' | 'excerpt' | 'content'>,
  thematicSource = false
): RelevanceEvaluation | null {
  const { raw, normalized } = articleText(article)
  if (!normalized) return null

  const reasons: MatchReason[] = []
  let score = 0
  let direct = false
  let ruleVersion = 1

  for (const rule of rules.filter((item) => item.active !== false)) {
    const terms = ruleMatches(rule, normalized, raw)
    if (!terms) continue
    reasons.push({
      rule_id: rule.id,
      label: rule.label,
      match_type: rule.match_type,
      terms,
      weight: rule.weight,
    })
    score += rule.weight
    direct ||= rule.match_type === 'direta'
    ruleVersion = Math.max(ruleVersion, rule.version)
  }

  // A thematic feed is evidence, not permission to include an obvious road
  // story in DAQ. The contextual hard guard wins over source membership.
  const sourceRequiresContext =
    client.name.startsWith('DAQ') ||
    client.name === 'SIMINERAL' ||
    client.name === 'SINDINFOR'
  if (
    thematicSource &&
    !isDaqRoadFalsePositive(client, normalized) &&
    (!sourceRequiresContext || reasons.length > 0)
  ) {
    reasons.push({
      label: 'fonte temática vinculada',
      match_type: 'fonte',
      terms: [],
      weight: 1,
    })
    score += 1
  }

  if (!score || isDaqRoadFalsePositive(client, normalized)) return null

  const confidence = direct ? 0.98 : score >= 5 ? 0.9 : score >= 3 ? 0.78 : 0.55
  const monitoringStatus: MonitoringStatus = direct || score >= 5 ? 'confirmado' : score >= 3 ? 'candidato' : 'revisao'
  const relevancia: Relevancia = direct || score >= 5 ? 'alta' : score >= 3 ? 'media' : 'baixa'
  const primary = reasons.find((reason) => reason.match_type !== 'fonte') || reasons[0]

  return {
    monitoring_status: monitoringStatus,
    match_score: score,
    match_reasons: reasons,
    rule_version: ruleVersion,
    confidence,
    cita_cliente: direct,
    relevancia,
    tema: primary?.label || null,
  }
}

export function mergeAutomatedEvaluation(
  existing: ArticleTag | null,
  evaluation: RelevanceEvaluation,
  now = new Date().toISOString()
): ArticleTag {
  const human = existing?.classification_source === 'humano'
  return {
    article_id: existing?.article_id || '',
    client_id: existing?.client_id || '',
    tom: human ? (existing?.tom ?? 'neutro') : (existing?.tom ?? 'neutro'),
    relevancia: human ? (existing?.relevancia ?? evaluation.relevancia) : evaluation.relevancia,
    cita_cliente: human ? (existing?.cita_cliente ?? evaluation.cita_cliente) : evaluation.cita_cliente,
    tema: human ? (existing?.tema ?? evaluation.tema) : evaluation.tema,
    classification_source: human ? 'humano' : 'regra',
    confidence: human ? (existing?.confidence ?? evaluation.confidence) : evaluation.confidence,
    impact_summary: existing?.impact_summary ?? null,
    monitoring_status: human
      ? (existing?.monitoring_status ?? evaluation.monitoring_status)
      : evaluation.monitoring_status,
    match_score: evaluation.match_score,
    match_reasons: evaluation.match_reasons,
    rule_version: evaluation.rule_version,
    classified_at: now,
    updated_at: human ? existing?.updated_at : now,
  }
}
