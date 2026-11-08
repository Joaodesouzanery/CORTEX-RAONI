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
import { isOffTopicSection } from '@/lib/noise'

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

function isInvalidNewsDocument(title: string): boolean {
  const normalized = normalizeText(title)
  return (
    /\.(cdr|psd|ai|zip|xlsx?|docx?)$/i.test(title.trim()) ||
    /^portfolio\b/.test(normalized) ||
    /^portifolio\b/.test(normalized) ||
    /^login\b/.test(normalized) ||
    normalized === 'inicio'
  )
}

function isSimineralHardFalsePositive(client: Client, normalized: string): boolean {
  if (client.name !== 'SIMINERAL') return false
  if (/\b(criptomoeda|bitcoin|ethereum|mineracao de cripto|minerar cripto)\b/.test(normalized)) return true
  const market =
    /\b(ibovespa|vale3|cmin3|day trade|carteira recomendada|dividendos|cotacao|acoes)\b/.test(normalized)
  const strategic =
    /\b(anm|cfem|licenciamento|regulacao|minerais criticos|minerais estrategicos|terras raras|mineracao no para|setor mineral do para|amazonia|carajas)\b/.test(
      normalized
    )
  return market && !strategic
}

export function evaluateClientArticle(
  client: Client,
  rules: ClientRelevanceRule[],
  article: Pick<Article, 'title' | 'excerpt' | 'content'> & { url?: string | null; resolved_url?: string | null },
  thematicSource = false
): RelevanceEvaluation | null {
  const { raw, normalized } = articleText(article)
  if (!normalized || isInvalidNewsDocument(article.title) || isSimineralHardFalsePositive(client, normalized)) return null

  const reasons: MatchReason[] = []
  let score = 0
  let direct = false
  let ruleVersion = 1

  // Título + resumo: onde a matéria diz do que trata. Regra de setor que só
  // casa no corpo pegava "PEC da Segurança" e eleição nos EUA por um termo
  // perdido no meio do texto (print de 04/11/2026).
  const headRaw = [article.title, article.excerpt].filter(Boolean).join(' ')
  const headNormalized = normalizeText(headRaw)

  // Caderno de esporte/entretenimento não vira Setor (src/lib/noise.ts).
  const offTopic = isOffTopicSection(article.resolved_url || article.url, article.title)
  const activeRules = rules.filter((item) => item.active !== false)
  // Setor só no corpo conta quando há assunto, não citação perdida: duas
  // regras diferentes casando no corpo, ou dois termos do MESMO grupo. Termos
  // de grupos diferentes da mesma regra não bastam: uma regra de dois grupos
  // sempre rende dois termos (revisão adversarial de 08/11/2026).
  const bodyOnlyRules: Array<{ rule: ClientRelevanceRule; terms: string[] }> = []
  let bodyOnlyStrong = false

  for (const rule of activeRules) {
    const terms = ruleMatches(rule, normalized, raw)
    if (!terms) continue
    if (rule.match_type !== 'direta' && offTopic) continue
    if (rule.match_type !== 'direta' && headNormalized && !matchingTerms(terms, headNormalized, headRaw).length) {
      const groups = Array.isArray(rule.required_groups) ? rule.required_groups : []
      if (groups.some((group) => new Set(matchingTerms(group, normalized, raw).map(normalizeText)).size >= 2)) bodyOnlyStrong = true
      bodyOnlyRules.push({ rule, terms })
      continue
    }
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
  // Para a ANTAQ a guarda não é sobre a consulta de hoje: é proteção contra
  // alguém marcar amanhã um feed largo (Portos e Navios, Agência Infra) como
  // temático. Custo ~zero, porque toda matéria genuína aciona a regra direta.
  // `startsWith` e não `===`: se o curador digitar o nome por extenso na UI,
  // uma comparação exata desligaria a guarda em silêncio.
  // Desde 04/11/2026 vale para todos: fonte do cliente só soma quando alguma
  // regra já casou. Sozinha ela marcava toda manchete de um feed de grande
  // veículo (051) para o cliente.
  // Setor só no corpo (08/11/2026). Desde 04/11 isso era descartado, e o
  // setor sumiu da tela: RSS de Valor/Estadão/Folha costuma trazer resumo
  // curto, e o assunto fica no corpo. Volta a contar com peso 1 — sempre
  // `revisao`, nunca base qualificada — quando a matéria veio de fonte
  // temática do cliente ou tem assunto de setor (regra acima). Um termo
  // perdido em matéria de pauta alheia (PEC da Segurança, print de 04/11)
  // continua fora.
  if (!reasons.length && bodyOnlyRules.length && (thematicSource || bodyOnlyStrong || bodyOnlyRules.length >= 2)) {
    const first = bodyOnlyRules[0]
    reasons.push({
      rule_id: first.rule.id,
      label: first.rule.label,
      match_type: first.rule.match_type,
      terms: Array.from(new Set(bodyOnlyRules.flatMap((item) => item.terms))),
      weight: 1,
    })
    score += 1
    ruleVersion = Math.max(ruleVersion, first.rule.version)
  }

  if (thematicSource && !isDaqRoadFalsePositive(client, normalized) && reasons.length > 0) {
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
    manual_intake: existing?.manual_intake ?? false,
    manual_received_at: existing?.manual_received_at ?? null,
    updated_at: human ? existing?.updated_at : now,
  }
}
