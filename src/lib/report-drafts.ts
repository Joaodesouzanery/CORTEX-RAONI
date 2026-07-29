import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Article,
  ArticleSnapshot,
  ArticleTag,
  Client,
  EvidenceBucket,
  ReportBrand,
  ReportEvidenceItem,
} from '@/types'

type TaggedArticleRow = ArticleTag & {
  articles: Article & { sources?: { name: string; categoria?: string } }
}

export function monthBounds(period: string) {
  const [year, month] = period.slice(0, 7).split('-').map(Number)
  const start = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00-03:00`)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00-03:00`)
  return { start: start.toISOString(), end: end.toISOString(), date: `${period.slice(0, 7)}-01` }
}

export function reportBrand(client: Client): ReportBrand {
  const fallback = client.contratante?.trim() || client.name
  return {
    name: client.report_brand_name?.trim() || fallback,
    footer:
      client.report_brand_footer?.trim() ||
      (fallback ? `Suporte Estratégico Prestado por: ${fallback}` : null),
    guidelines: client.report_brand_guidelines?.trim() || null,
    contratante: client.contratante,
    client_name: client.name,
  }
}

function snapshot(row: TaggedArticleRow): ArticleSnapshot {
  const article = row.articles
  const categoria = article.sources?.categoria
  return {
    id: article.id,
    title: article.title,
    url: article.url,
    image_url: article.image_url,
    excerpt: article.excerpt,
    content: article.content || null,
    content_status: article.content_status || 'parcial',
    author: article.author || null,
    published_at: article.published_at,
    publisher: article.publisher || null,
    source_name: article.sources?.name || null,
    source_categoria:
      categoria === 'institucional' || categoria === 'agente' || categoria === 'imprensa'
        ? categoria
        : 'imprensa',
  }
}

function editorialScore(row: TaggedArticleRow) {
  if (typeof row.editorial_score === 'number') return row.editorial_score
  let score = row.cita_cliente ? 90 : row.relevancia === 'alta' ? 80 : row.relevancia === 'media' ? 60 : 35
  if (row.monitoring_status === 'confirmado') score += 5
  if (row.monitoring_status === 'revisao') score = Math.min(score, 35)
  return Math.max(0, Math.min(100, score))
}

function bucketFor(row: TaggedArticleRow): EvidenceBucket {
  if (row.monitoring_status === 'excluido') return 'excluded'
  if (row.report_role_source === 'humano') {
    if (row.report_role === 'evidencia') return 'qualified'
    if (row.report_role === 'ruido' || row.report_role === 'contexto') return 'annex'
  }
  if (row.report_role === 'evidencia') return 'qualified'
  if (row.report_role === 'ruido' || row.report_role === 'contexto') return 'annex'
  return editorialScore(row) >= 55 && row.monitoring_status !== 'revisao' ? 'qualified' : 'annex'
}

export async function fetchAll<T>(
  queryPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  const output: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await queryPage(from, from + 999)
    if (error) throw new Error(error.message)
    output.push(...(data || []))
    if (!data || data.length < 1000) break
  }
  return output
}

export async function reportEvidenceItems(
  supabase: SupabaseClient,
  draftId: string,
  includeExcluded = true
): Promise<ReportEvidenceItem[]> {
  return fetchAll<ReportEvidenceItem>((from, to) => {
    let query = supabase
      .from('report_evidence_items')
      .select('*')
      .eq('draft_id', draftId)
      .order('bucket')
      .order('position')
      .range(from, to)
    if (!includeExcluded) query = query.neq('bucket', 'excluded')
    return query as unknown as PromiseLike<{
      data: ReportEvidenceItem[] | null
      error: { message: string } | null
    }>
  })
}

export async function monthlyTaggedArticles(
  supabase: SupabaseClient,
  clientId: string,
  period: string
): Promise<TaggedArticleRow[]> {
  const { start, end, date } = monthBounds(period)
  const dated = await fetchAll<TaggedArticleRow>((from, to) =>
    supabase
      .from('article_client_tags')
      .select('*, articles!inner(*, sources(name, categoria))')
      .eq('client_id', clientId)
      .gte('articles.published_at', start)
      .lt('articles.published_at', end)
      .order('published_at', { referencedTable: 'articles', ascending: false })
      .range(from, to) as unknown as PromiseLike<{
      data: TaggedArticleRow[] | null
      error: { message: string } | null
    }>
  )

  const assignments = await fetchAll<{ article_id: string }>((from, to) =>
    supabase
      .from('article_period_assignments')
      .select('article_id')
      .eq('client_id', clientId)
      .eq('period_month', date)
      .range(from, to)
  )
  const assignmentIds = Array.from(new Set(assignments.map((row) => row.article_id)))
  const imported: TaggedArticleRow[] = []
  for (let offset = 0; offset < assignmentIds.length; offset += 300) {
    const { data, error } = await supabase
      .from('article_client_tags')
      .select('*, articles!inner(*, sources(name, categoria))')
      .eq('client_id', clientId)
      .in('article_id', assignmentIds.slice(offset, offset + 300))
    if (error) throw new Error(error.message)
    imported.push(...((data || []) as unknown as TaggedArticleRow[]))
  }

  const unique = new Map<string, TaggedArticleRow>()
  for (const row of [...dated, ...imported]) {
    if (row.articles?.id) unique.set(row.articles.id, row)
  }
  return Array.from(unique.values())
}

function classificationSnapshot(row: TaggedArticleRow) {
  return {
    tom: row.tom,
    relevancia: row.relevancia,
    cita_cliente: row.cita_cliente,
    tema: row.tema,
    confidence: row.confidence,
    impact_summary: row.impact_summary,
    monitoring_status: row.monitoring_status,
    report_role: row.report_role,
    editorial_score: editorialScore(row),
    editorial_reason: row.editorial_reason,
    cluster_label: row.cluster_label,
    report_role_source: row.report_role_source,
    triaged_at: row.triaged_at,
    triage_version: row.triage_version,
  }
}

export function evidencePayload(rows: TaggedArticleRow[]) {
  const groups: Record<EvidenceBucket, TaggedArticleRow[]> = {
    qualified: [],
    annex: [],
    excluded: [],
  }
  for (const row of rows) groups[bucketFor(row)].push(row)
  const sortRows = (a: TaggedArticleRow, b: TaggedArticleRow) => {
    const score = editorialScore(b) - editorialScore(a)
    if (score) return score
    return (b.articles.published_at || '').localeCompare(a.articles.published_at || '')
  }
  return (Object.keys(groups) as EvidenceBucket[]).flatMap((bucket) =>
    groups[bucket].sort(sortRows).map((row, index) => ({
      article_id: row.articles.id,
      bucket,
      position: index + 1,
      article_snapshot: snapshot(row),
      classification_snapshot: classificationSnapshot(row),
      cluster_key: row.cluster_label || null,
    }))
  )
}

export async function refreshDraftEvidence(
  supabase: SupabaseClient,
  draft: { id: string; client_id: string; period_month: string; base_version?: number }
) {
  const rows = await monthlyTaggedArticles(supabase, draft.client_id, draft.period_month.slice(0, 7))
  const items = evidencePayload(rows)
  const { data, error } = await supabase.rpc('replace_report_evidence', {
    p_draft_id: draft.id,
    p_items: items,
  })
  if (error) throw new Error(error.message)
  const now = new Date().toISOString()
  const { data: sections } = await supabase
    .from('report_sections')
    .select('id, status')
    .eq('draft_id', draft.id)
    .in('status', ['generated', 'edited'])
  if (sections?.length) {
    await supabase
      .from('report_sections')
      .update({ status: 'stale', updated_at: now })
      .in('id', sections.map((section) => section.id))
  }
  const counts = {
    total: items.length,
    qualified: items.filter((item) => item.bucket === 'qualified').length,
    annex: items.filter((item) => item.bucket === 'annex').length,
    excluded: items.filter((item) => item.bucket === 'excluded').length,
  }
  const untriaged = items.filter(
    (item) =>
      item.bucket !== 'excluded' &&
      !item.classification_snapshot.triaged_at &&
      item.classification_snapshot.report_role_source !== 'humano'
  ).length
  const { data: updated, error: updateError } = await supabase
    .from('monthly_report_drafts')
    .update({
      base_version: (draft.base_version || 0) + 1,
      base_refreshed_at: now,
      status: sections?.length ? 'stale' : untriaged ? 'preparing' : 'ready',
      updated_at: now,
      error: null,
    })
    .eq('id', draft.id)
    .select()
    .single()
  if (updateError) throw new Error(updateError.message)
  return { draft: updated, counts: { ...counts, untriaged }, inserted: Number(data || 0) }
}

export function evidenceArticles(items: ReportEvidenceItem[], leadArticleId?: string | null): Article[] {
  return items
    .filter((item) => item.bucket === 'qualified')
    .sort((a, b) => {
      if (a.article_id === leadArticleId) return -1
      if (b.article_id === leadArticleId) return 1
      return a.position - b.position
    })
    .map((item) => ({
      ...item.article_snapshot,
      source_id: '',
      fetched_at: item.created_at,
      sources: item.article_snapshot.source_name
        ? { name: item.article_snapshot.source_name, categoria: item.article_snapshot.source_categoria }
        : undefined,
    }))
}

function evidenceLine(item: ReportEvidenceItem, index: number) {
  const article = item.article_snapshot
  const publisher = article.publisher || article.source_name || 'Veículo não identificado'
  const date = article.published_at ? new Date(article.published_at).toLocaleDateString('pt-BR') : 'sem data'
  return `${index + 1}. **${publisher}** — ${article.title} (${date})`
}

export function buildQualifiedSection(items: ReportEvidenceItem[]) {
  const qualified = items.filter((item) => item.bucket === 'qualified').sort((a, b) => a.position - b.position)
  return `## 10. BASE QUALIFICADA DE EVIDÊNCIAS MONITORADAS NO MÊS\n\n${
    qualified.length ? qualified.map(evidenceLine).join('\n') : '_Nenhuma evidência qualificada._'
  }`
}

export function buildAnnex(items: ReportEvidenceItem[]) {
  const annex = items.filter((item) => item.bucket === 'annex').sort((a, b) => a.position - b.position)
  return `# ANEXO MONITORADO\n\nItens de contexto, baixa confiança e ruído preservados para auditoria. Não alimentaram diretamente a redação das seções 1–10.\n\n${
    annex.length ? annex.map(evidenceLine).join('\n') : '_Nenhuma ocorrência no anexo._'
  }`
}

export function buildDossier(items: ReportEvidenceItem[]) {
  return [buildQualifiedSection(items), '---', buildAnnex(items)].join('\n\n')
}

export function ensureLeadInSection(
  markdown: string,
  section: number,
  lead: Pick<ReportEvidenceItem, 'article_snapshot'>
) {
  const title = lead.article_snapshot.title
  if (markdown.toLocaleLowerCase('pt-BR').includes(title.toLocaleLowerCase('pt-BR'))) return markdown
  const publisher = lead.article_snapshot.publisher || lead.article_snapshot.source_name || 'veículo não identificado'
  const paragraph = `A matéria principal do mês, **“${title}”** (${publisher}), orienta a leitura estratégica desta seção.`
  if (section === 4) {
    const block = `### 4.1. Matéria principal — ${title}\n\n${paragraph}\n\n**Leitura estratégica:** Tratar este ativo como eixo central do posicionamento institucional do mês.`
    return markdown.replace(/(##\s+4[^\n]*\n)/i, `$1\n${block}\n\n`)
  }
  return markdown.replace(/(##\s+1[^\n]*\n)/i, `$1\n${paragraph}\n\n`)
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export function evidenceCsv(items: ReportEvidenceItem[]) {
  const header = ['bucket', 'position', 'article_id', 'vehicle', 'title', 'published_at', 'url', 'score', 'reason']
  const rows = items
    .filter((item) => item.bucket !== 'excluded')
    .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.position - b.position)
    .map((item) => {
      const article = item.article_snapshot
      const classification = item.classification_snapshot
      return [
        item.bucket,
        item.position,
        item.article_id,
        article.publisher || article.source_name,
        article.title,
        article.published_at,
        article.url,
        classification.editorial_score,
        classification.editorial_reason,
      ]
        .map(csvCell)
        .join(',')
    })
  return [header.map(csvCell).join(','), ...rows].join('\n')
}
