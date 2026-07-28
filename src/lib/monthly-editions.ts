import type { SupabaseClient } from '@supabase/supabase-js'
import type { Article, ArticleTag, Client, MonthlyEdition, MonthlyEditionItem, Relevancia, Tom } from '@/types'
import { parseKeywords, expandTerms, isRelevant, normalizeText, relevanceScore } from '@/lib/relevance'
import { heuristicSuggest } from '@/lib/ai/classify'
import { clusterKey, editionSection, monthBounds, snapshotArticle, tomLabel } from '@/lib/archive'

const PAGE = 1000

export type ClientWithSources = Client & {
  client_sources?: Array<{ source_id: string; is_thematic: boolean; priority: number }>
}

async function loadMonthArticles(supabase: SupabaseClient, start: string, end: string): Promise<Article[]> {
  const all: Article[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('articles')
      .select('*, sources(name, categoria, is_general)')
      .gte('published_at', start)
      .lt('published_at', end)
      .order('published_at', { ascending: false })
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data as unknown as Article[]) || []
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

function aliasesFor(name: string): string[] {
  if (name === 'ONS') return ['ONS', 'Operador Nacional do Sistema Elétrico', 'Operador Nacional do Sistema']
  if (name === 'CCEE') return ['CCEE', 'Câmara de Comercialização de Energia Elétrica', 'Câmara de Comercialização']
  if (name.startsWith('DAQ')) return ['DAQ', 'Diretoria de Infraestrutura Aquaviária', 'DNIT']
  if (name === 'SINDINFOR') return ['SINDINFOR', 'Sindicato da Indústria de Software e da Tecnologia da Informação']
  if (name === 'SIMINERAL') return ['SIMINERAL', 'Sindicato das Indústrias Minerais do Estado do Pará']
  return [name]
}

function citesClient(article: Article, client: Client): boolean {
  const text = normalizeText([article.title, article.excerpt, article.content].filter(Boolean).join(' '))
  return parseKeywords(aliasesFor(client.name)).some((kw) => {
    const tokens = text.split(' ')
    if (kw.tokens.length === 1) return tokens.includes(kw.tokens[0])
    return text.includes(kw.normalized)
  })
}

function confidenceFor(opts: {
  direct: boolean
  thematic: boolean
  score: number
  relevancia: Relevancia | null
}): number {
  if (opts.direct) return 0.98
  if (opts.thematic && opts.score > 0) return 0.88
  if (opts.thematic) return 0.72
  if (opts.relevancia === 'alta' || opts.score >= 3) return 0.82
  if (opts.score >= 1) return 0.62
  return 0.4
}

function mergeTag(
  article: Article,
  client: Client,
  existing: ArticleTag | undefined,
  thematic: boolean,
  score: number
): ArticleTag {
  const forHeuristic: Article = {
    ...article,
    excerpt: [article.excerpt, article.content?.slice(0, 1200)].filter(Boolean).join(' ') || null,
  }
  const suggestion = heuristicSuggest(forHeuristic, client)
  const direct = existing?.cita_cliente ?? citesClient(article, client)
  const relevancia = existing?.relevancia ?? suggestion.relevancia
  return {
    article_id: article.id,
    client_id: client.id,
    tom: existing?.tom ?? suggestion.tom ?? 'neutro',
    relevancia,
    cita_cliente: direct,
    tema: existing?.tema ?? suggestion.tema,
    classification_source: existing?.classification_source ?? 'regra',
    confidence: existing?.confidence ?? confidenceFor({ direct, thematic, score, relevancia }),
    impact_summary:
      existing?.impact_summary ??
      (direct
        ? `A publicação cita ${client.name} diretamente em contexto relacionado a ${suggestion.tema || client.sector || 'sua atuação'}.`
        : `Cobertura do setor relacionada a ${suggestion.tema || client.sector || 'tema monitorado'}.`),
  }
}

export async function createEditionForClient(
  supabase: SupabaseClient,
  client: ClientWithSources,
  period: string,
  reuseExisting = false
): Promise<MonthlyEdition> {
  const { month, start, end } = monthBounds(period)
  if (reuseExisting) {
    const { data: existing, error } = await supabase
      .from('monthly_editions')
      .select('*, clients(name, logo_url)')
      .eq('client_id', client.id)
      .eq('period_month', month)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (existing) return existing as unknown as MonthlyEdition
  }
  const allArticles = await loadMonthArticles(supabase, start, end)
  const terms = parseKeywords(expandTerms(client.keywords, client.synonyms))
  const sourceRules = new Map((client.client_sources || []).map((row) => [row.source_id, row]))
  const candidates = allArticles.filter((article) => {
    const sourceRule = sourceRules.get(article.source_id)
    const keywordMatch = isRelevant(terms, {
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
    })
    return keywordMatch || sourceRule?.is_thematic === true
  })

  const existingTags = new Map<string, ArticleTag>()
  for (let offset = 0; offset < candidates.length; offset += PAGE) {
    const ids = candidates.slice(offset, offset + PAGE).map((a) => a.id)
    if (!ids.length) continue
    const { data, error } = await supabase
      .from('article_client_tags')
      .select('*')
      .eq('client_id', client.id)
      .in('article_id', ids)
    if (error) throw new Error(error.message)
    for (const tag of (data as ArticleTag[]) || []) existingTags.set(tag.article_id, tag)
  }

  const pdfOrigins = new Map<string, { document_id: string; page_start: number; page_end: number }>()
  for (let offset = 0; offset < candidates.length; offset += PAGE) {
    const ids = candidates.slice(offset, offset + PAGE).map((article) => article.id)
    if (!ids.length) continue
    const { data, error } = await supabase
      .from('article_provenance')
      .select('article_id, source_document_id, page_start, page_end')
      .in('article_id', ids)
      .not('source_document_id', 'is', null)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    for (const row of data || []) {
      if (
        !pdfOrigins.has(row.article_id) &&
        row.source_document_id &&
        Number.isInteger(row.page_start) &&
        Number.isInteger(row.page_end)
      ) {
        pdfOrigins.set(row.article_id, {
          document_id: row.source_document_id,
          page_start: row.page_start,
          page_end: row.page_end,
        })
      }
    }
  }

  const rows = candidates.map((article) => {
    const sourceRule = sourceRules.get(article.source_id)
    const score = relevanceScore(terms, {
      title: article.title,
      excerpt: article.excerpt,
      content: article.content,
    })
    const tag = mergeTag(article, client, existingTags.get(article.id), sourceRule?.is_thematic === true, score)
    return { article, tag, section: editionSection(tag) }
  })

  const sectionOrder = { mencao_direta: 0, cobertura_setorial: 1, baixa_confianca: 2 } as const
  rows.sort((a, b) => {
    const sectionDelta = sectionOrder[a.section] - sectionOrder[b.section]
    if (sectionDelta) return sectionDelta
    const da = a.article.published_at ? new Date(a.article.published_at).getTime() : 0
    const db = b.article.published_at ? new Date(b.article.published_at).getTime() : 0
    return db - da
  })

  if (rows.length) {
    const now = new Date().toISOString()
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await supabase.from('article_client_tags').upsert(
        rows.slice(offset, offset + 500).map(({ tag }) => ({ ...tag, updated_at: now })),
        { onConflict: 'article_id,client_id' }
      )
      if (error) throw new Error(error.message)
    }
  }

  const { data: latest } = await supabase
    .from('monthly_editions')
    .select('version')
    .eq('client_id', client.id)
    .eq('period_month', month)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const version = (latest?.version || 0) + 1

  const counts = {
    total: rows.length,
    integral: rows.filter((r) => snapshotArticle(r.article).content_status === 'integral').length,
    parcial: rows.filter((r) => snapshotArticle(r.article).content_status === 'parcial').length,
    metadados: rows.filter((r) => snapshotArticle(r.article).content_status === 'metadados').length,
    mencoes_diretas: rows.filter((r) => r.section === 'mencao_direta').length,
    cobertura_setorial: rows.filter((r) => r.section === 'cobertura_setorial').length,
    baixa_confianca: rows.filter((r) => r.section === 'baixa_confianca').length,
  }

  const { data: edition, error: editionError } = await supabase
    .from('monthly_editions')
    .insert({
      client_id: client.id,
      period_month: month,
      version,
      status: 'rascunho',
      counts,
    })
    .select('*, clients(name, logo_url)')
    .single()
  if (editionError || !edition) throw new Error(editionError?.message || 'Falha ao criar edição.')

  if (rows.length) {
    const snapshots = rows.map(({ article, tag, section }, index) => ({
      edition_id: edition.id,
      article_id: article.id,
      position: index + 1,
      section,
      cluster_key: clusterKey(article.title, article.published_at),
      article_snapshot: {
        ...snapshotArticle(article),
        origin_pdf: pdfOrigins.get(article.id) || null,
      },
      classification_snapshot: {
        tom: tag.tom,
        relevancia: tag.relevancia,
        cita_cliente: tag.cita_cliente,
        tema: tag.tema,
        confidence: tag.confidence,
        impact_summary: tag.impact_summary,
      },
    }))
    for (let offset = 0; offset < snapshots.length; offset += 100) {
      const { error: itemsError } = await supabase
        .from('monthly_edition_items')
        .insert(snapshots.slice(offset, offset + 100))
      if (itemsError) {
        await supabase.from('monthly_editions').delete().eq('id', edition.id)
        throw new Error(itemsError.message)
      }
    }
  }

  return edition as unknown as MonthlyEdition
}

type SummaryItem = Pick<MonthlyEditionItem, 'cluster_key' | 'section' | 'article_snapshot' | 'classification_snapshot'>

function topicSignature(item: SummaryItem): { day: string; tokens: Set<string> } {
  const day = item.article_snapshot.published_at?.slice(0, 10) || 'sem-data'
  const stop = new Set(['para', 'como', 'mais', 'sobre', 'pela', 'pelo', 'entre', 'apos', 'brasil'])
  return {
    day,
    tokens: new Set(
      normalizeText(item.article_snapshot.title)
        .split(' ')
        .filter((token) => token.length >= 4 && !stop.has(token))
    ),
  }
}

function sameTopic(first: SummaryItem, second: SummaryItem): boolean {
  const a = topicSignature(first)
  const b = topicSignature(second)
  if (a.day !== b.day || a.day === 'sem-data') return false
  if (!a.tokens.size || !b.tokens.size) return false
  let shared = 0
  a.tokens.forEach((token) => {
    if (b.tokens.has(token)) shared++
  })
  return shared >= 3 && shared / Math.min(a.tokens.size, b.tokens.size) >= 0.6
}

function groupTopics(items: SummaryItem[]) {
  const groups: SummaryItem[][] = []
  for (const item of items) {
    const group = groups.find(
      (candidate) =>
        (candidate[0].cluster_key && item.cluster_key && candidate[0].cluster_key === item.cluster_key) ||
        sameTopic(candidate[0], item)
    )
    if (group) group.push(item)
    else groups.push([item])
  }
  return groups.sort((a, b) => b.length - a.length)
}

function paragraphFor(group: SummaryItem[], clientName: string): string {
  const first = group[0]
  const outlets = Array.from(
    new Set(
      group.map((i) => i.article_snapshot.publisher || i.article_snapshot.source_name || 'Veículo não identificado')
    )
  )
  const tag = first.classification_snapshot
  const lead =
    outlets.length === 1
      ? `${outlets[0]} publicou que ${first.article_snapshot.title}.`
      : `${outlets.slice(0, -1).join(', ')} e ${outlets[outlets.length - 1]} publicaram sobre “${first.article_snapshot.title}”.`
  const context = tag.impact_summary ? ` ${tag.impact_summary}` : ''
  const ending =
    first.section === 'mencao_direta' ? ` A menção a ${clientName} foi ${tomLabel(tag.tom as Tom | null)}.` : ''
  return `${lead}${context}${ending}`
}

export function buildEditionSummary(
  items: SummaryItem[],
  clientName: string,
  periodLabel: string
): { markdown: string; data: Record<string, unknown> } {
  const direct = groupTopics(items.filter((i) => i.section === 'mencao_direta'))
  const sector = groupTopics(items.filter((i) => i.section === 'cobertura_setorial'))
  const uncertain = items.filter((i) => i.section === 'baixa_confianca')
  const directText = direct.length
    ? direct
        .slice(0, 20)
        .map((g) => paragraphFor(g, clientName))
        .join('\n\n')
    : 'Não foram identificadas menções diretas no período.'
  const sectorText = sector.length
    ? sector
        .slice(0, 30)
        .map((g) => paragraphFor(g, clientName))
        .join('\n\n')
    : 'Não foram identificadas pautas setoriais no período.'
  const markdown = [
    `# Síntese do clipping — ${clientName}`,
    `**${periodLabel}**`,
    '## Menções diretas',
    directText,
    '## Cobertura setorial',
    sectorText,
    uncertain.length
      ? `## Outras ocorrências monitoradas\n\n${uncertain.length} item(ns) foram preservados com baixa confiança para conferência.`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  return {
    markdown,
    data: {
      directTopics: direct.length,
      sectorTopics: sector.length,
      uncertain: uncertain.length,
      generatedBy: 'deterministic-fallback',
    },
  }
}
