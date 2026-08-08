import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { topicMatchesArticle } from '@/lib/monthly-agenda'
import { monthBounds, refreshDraftEvidence, reportEvidenceItems } from '@/lib/report-drafts'
import type { ArticleSnapshot, MonthlyReportTopic, RegulatoryCycleStage } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

async function archiveTopicCandidates(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  period: string
) {
  const { end } = monthBounds(period)
  const earliest = new Date(new Date(end).getTime() - 120 * 86400000).toISOString()
  const rows: Array<{ article_id: string; articles: ArticleSnapshot | ArticleSnapshot[] }> = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('article_client_tags')
      .select('article_id, articles!inner(*)')
      .eq('client_id', clientId)
      .gte('articles.published_at', earliest)
      .lt('articles.published_at', end)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = (data || []) as unknown as Array<{ article_id: string; articles: ArticleSnapshot | ArticleSnapshot[] }>
    rows.push(...page)
    if (page.length < 1000) break
  }
  return rows.map((row) => ({
    article_id: row.article_id,
    article: Array.isArray(row.articles) ? row.articles[0] : row.articles,
  }))
}

async function assignArchiveMatches(
  supabase: ReturnType<typeof createClient>,
  draft: Record<string, unknown>,
  topic: MonthlyReportTopic,
  articleIds: string[]
) {
  if (!articleIds.length) return
  const storagePath = `agenda://${draft.id}/${topic.id}`
  let { data: document } = await supabase
    .from('source_documents')
    .select('id')
    .eq('storage_path', storagePath)
    .maybeSingle()
  if (!document) {
    const digest = createHash('sha256').update(storagePath).digest('hex')
    const created = await supabase
      .from('source_documents')
      .insert({
        filename: `Agenda — ${topic.title}`,
        storage_path: storagePath,
        sha256: digest,
        document_type: 'mensagem',
        status: 'concluido',
        metadata: { kind: 'agenda_period_assignment', draft_id: draft.id, topic_id: topic.id },
        processed_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (created.error || !created.data) throw new Error(created.error?.message || 'Falha ao registrar associação editorial.')
    document = created.data
  }
  const cycleStage: RegulatoryCycleStage | null = /decret|vig[eê]ncia|regula/i.test(topic.title)
    ? 'vigencia'
    : null
  const { error } = await supabase.from('article_period_assignments').upsert(
    articleIds.map((articleId) => ({
      article_id: articleId,
      client_id: draft.client_id,
      period_month: draft.period_month,
      source_document_id: document!.id,
      editorial_reason: `Publicação anterior associada à competência por sustentar o tópico obrigatório “${topic.title}”.`,
      cycle_stage: cycleStage,
    })),
    { onConflict: 'article_id,client_id,period_month,source_document_id' }
  )
  if (error) throw new Error(error.message)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; topicId: string }> }
) {
  const { id, topicId } = await params
  const body = await req.json().catch(() => ({}))
  const afterFetch = body?.after_fetch === true
  const supabase = createClient()
  const [{ data: draft }, { data: topic }, evidence] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    supabase.from('monthly_report_topics').select('*').eq('id', topicId).eq('draft_id', id).single(),
    reportEvidenceItems(supabase, id, false),
  ])
  if (!draft || !topic) return NextResponse.json({ error: 'Preparação ou tópico não encontrado.' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })

  const typedTopic = topic as MonthlyReportTopic
  const archive = await archiveTopicCandidates(supabase, draft.client_id, draft.period_month)
  const candidates = new Map<string, ArticleSnapshot>()
  for (const item of evidence) candidates.set(item.article_id, item.article_snapshot)
  for (const item of archive) if (item.article) candidates.set(item.article_id, item.article)
  const matched = Array.from(candidates.entries()).flatMap(([articleId, article]) => {
    const result = topicMatchesArticle(typedTopic, article)
    return result.matched ? [{ articleId, article, terms: result.terms }] : []
  })
  const now = new Date().toISOString()
  const invalidateDraft = async () => {
    await Promise.all([
      supabase
        .from('monthly_report_drafts')
        .update({
          quality_status: 'pending',
          quality_summary: {},
          quality_checked_at: null,
          updated_at: now,
        })
        .eq('id', id),
      supabase
        .from('report_sections')
        .update({ status: 'stale', updated_at: now })
        .eq('draft_id', id)
        .eq('section_key', 2)
        .in('status', ['generated', 'edited']),
    ])
  }
  if (matched.length) {
    const currentIds = new Set(evidence.map((item) => item.article_id))
    const archiveIds = matched.map((item) => item.articleId).filter((articleId) => !currentIds.has(articleId))
    await assignArchiveMatches(supabase, draft, typedTopic, archiveIds)
    if (archiveIds.length) await refreshDraftEvidence(supabase, draft)
    const { error: linkError } = await supabase.from('report_topic_evidence').upsert(
      matched.map(({ articleId, terms }) => ({
        topic_id: topicId,
        article_id: articleId,
        source: 'regra',
        confidence: 0.7,
        reason: `Termos encontrados: ${terms.join(', ')}`,
        updated_at: now,
      })),
      { onConflict: 'topic_id,article_id' }
    )
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })
    await supabase
      .from('monthly_report_topics')
      .update({ coverage_status: 'review', gap_reason: null, gap_acknowledged_at: null, updated_at: now })
      .eq('id', topicId)
    await supabase.from('topic_search_runs').insert({
      topic_id: topicId,
      status: 'complete',
      query_snapshot: {
        inclusion_terms: topic.inclusion_terms,
        exclusion_terms: topic.exclusion_terms,
        local_archive: true,
      },
      matched_count: matched.length,
      linked_count: matched.length,
      started_at: now,
      finished_at: now,
    })
    await invalidateDraft()
    return NextResponse.json({ matched: matched.length, linked: matched.length, coverage_status: 'review' })
  }

  if (afterFetch) {
    const reason = 'Nenhuma publicação aderente foi encontrada após a busca complementar.'
    await Promise.all([
      supabase
        .from('monthly_report_topics')
        .update({ coverage_status: 'gap', gap_reason: reason, updated_at: now })
        .eq('id', topicId),
      supabase.from('topic_search_runs').insert({
        topic_id: topicId,
        status: 'gap',
        query_snapshot: {
          inclusion_terms: topic.inclusion_terms,
          exclusion_terms: topic.exclusion_terms,
          after_fetch: true,
        },
        started_at: now,
        finished_at: now,
      }),
    ])
    await invalidateDraft()
    return NextResponse.json({ matched: 0, linked: 0, coverage_status: 'gap' })
  }

  const { data: active } = await supabase
    .from('fetch_runs')
    .select('*')
    .in('status', ['pendente', 'executando'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  let fetchRun = active
  const clientName = Array.isArray(draft.clients) ? draft.clients[0]?.name : draft.clients?.name
  const searchTerms = Array.from(new Set([topic.title, ...(topic.inclusion_terms || [])])).filter(Boolean).slice(0, 8)
  const query = searchTerms.map((term: string) => term.includes(' ') ? `"${term}"` : term).join(' OR ')
  const sourceUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(`(${query}) ${clientName || ''}`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`
  const sourceName = `Busca agenda — ${clientName || draft.client_id} — ${topic.title}`.slice(0, 250)
  let { data: topicSource } = await supabase.from('sources').select('*').eq('url', sourceUrl).maybeSingle()
  if (!topicSource) {
    const createdSource = await supabase.from('sources').insert({
      name: sourceName,
      url: sourceUrl,
      type: 'rss',
      active: false,
      is_general: false,
      priority: 95,
      access_mode: 'publico',
      categoria: 'imprensa',
    }).select().single()
    if (createdSource.error) return NextResponse.json({ error: createdSource.error.message }, { status: 500 })
    topicSource = createdSource.data
  }
  const stableSourceId = topicSource.id as string
  await supabase.from('client_sources').upsert({
    client_id: draft.client_id,
    source_id: stableSourceId,
    priority: 95,
    is_thematic: true,
  }, { onConflict: 'client_id,source_id' })
  const { data: existingIntent } = await supabase
    .from('client_source_capture_intents')
    .select('id')
    .eq('client_id', draft.client_id)
    .eq('source_id', stableSourceId)
    .eq('intent', 'busca_lacuna')
    .eq('label', topic.title)
    .maybeSingle()
  const intentRow = {
    client_id: draft.client_id,
    source_id: stableSourceId,
    intent: 'busca_lacuna',
    label: topic.title,
    query_snapshot: { topic_id: topicId, inclusion_terms: topic.inclusion_terms, query, source_url: sourceUrl },
    active: true,
    updated_at: now,
  }
  if (existingIntent) await supabase.from('client_source_capture_intents').update(intentRow).eq('id', existingIntent.id)
  else await supabase.from('client_source_capture_intents').insert(intentRow)
  if (!fetchRun) {
    const { data: created, error: runError } = await supabase
      .from('fetch_runs')
      .insert({ trigger_type: 'manual', total_sources: 1 })
      .select()
      .single()
    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 })
    fetchRun = created
  }
  await supabase.from('fetch_run_sources').upsert({ run_id: fetchRun.id, source_id: stableSourceId }, { onConflict: 'run_id,source_id' })
  const { count: queuedCount } = await supabase.from('fetch_run_sources').select('source_id', { count: 'exact', head: true }).eq('run_id', fetchRun.id)
  await supabase.from('fetch_runs').update({ total_sources: queuedCount || 1 }).eq('id', fetchRun.id)
  await Promise.all([
    supabase
      .from('monthly_report_topics')
      .update({ coverage_status: 'searching', updated_at: now })
      .eq('id', topicId),
    supabase.from('topic_search_runs').insert({
      topic_id: topicId,
      status: 'searching',
      query_snapshot: {
        inclusion_terms: topic.inclusion_terms,
        exclusion_terms: topic.exclusion_terms,
        configured_sources: true,
        stable_source_id: stableSourceId,
      },
      fetch_run_id: fetchRun?.id || null,
      started_at: now,
    }),
  ])
  await invalidateDraft()
  return NextResponse.json({
    matched: 0,
    linked: 0,
    coverage_status: 'searching',
    fetch_run_id: fetchRun?.id || null,
  })
}
