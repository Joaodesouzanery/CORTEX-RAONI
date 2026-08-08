import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { monthBounds } from '@/lib/report-drafts'
import type { CaptureIntent, RegulatoryCycleStage } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const period = new URL(req.url).searchParams.get('period') || new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(period)) return NextResponse.json({ error: 'Competência inválida.' }, { status: 400 })
  const { start, end, date } = monthBounds(period)
  const supabase = createClient()
  const [{ data: tags, error }, { data: intents }, { data: draft }, { count: sourceAlerts }] = await Promise.all([
    supabase
      .from('article_client_tags')
      .select('article_id, report_role, cita_cliente, articles!inner(published_at, content_status, article_provenance(source_id))')
      .eq('client_id', id)
      .gte('articles.published_at', start)
      .lt('articles.published_at', end),
    supabase.from('client_source_capture_intents').select('*').eq('client_id', id).eq('active', true),
    supabase
      .from('monthly_report_drafts')
      .select('id')
      .eq('client_id', id)
      .eq('period_month', date)
      .neq('status', 'approved')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('operational_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id)
      .neq('status', 'resolved'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const topicResult = draft
    ? await supabase
        .from('monthly_report_topics')
        .select('id', { count: 'exact', head: true })
        .eq('draft_id', draft.id)
        .neq('coverage_status', 'covered')
    : { count: 0 }
  const rows = tags || []
  const intentRows = (intents || []) as Array<{
    intent: CaptureIntent
    cycle_stage: RegulatoryCycleStage | null
    source_id: string | null
  }>
  const sourcesByIntent = new Map<CaptureIntent, Set<string>>()
  const sourcesByStage = new Map<RegulatoryCycleStage, Set<string>>()
  const articleSources = new Map<string, Set<string>>()
  for (const row of rows) {
    const articles = Array.isArray(row.articles) ? row.articles[0] : row.articles
    const provenance = Array.isArray(articles?.article_provenance) ? articles.article_provenance : []
    articleSources.set(
      row.article_id,
      new Set(
        provenance
          .map((item: { source_id?: string }) => item.source_id)
          .filter((sourceId): sourceId is string => Boolean(sourceId))
      )
    )
  }
  for (const intent of intentRows) {
    const sources = sourcesByIntent.get(intent.intent) || new Set<string>()
    if (intent.source_id) sources.add(intent.source_id)
    sourcesByIntent.set(intent.intent, sources)
    if (intent.cycle_stage) {
      const stageSources = sourcesByStage.get(intent.cycle_stage) || new Set<string>()
      if (intent.source_id) stageSources.add(intent.source_id)
      sourcesByStage.set(intent.cycle_stage, stageSources)
    }
  }
  const byIntent = Array.from(sourcesByIntent.entries()).map(([intent, sourceIds]) => {
    const matched = rows.filter((row) => Array.from(articleSources.get(row.article_id) || []).some((sourceId) => sourceIds.has(sourceId)))
    return {
      intent,
      sources: sourceIds.size,
      monitored: matched.length,
      qualified: matched.filter((row) => row.report_role === 'evidencia').length,
    }
  })
  const contentStatuses = rows.map((row) => {
    const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
    return article?.content_status
  })
  const byCycleStage = Array.from(sourcesByStage.entries()).map(([stage, sourceIds]) => {
    const matched = rows.filter((row) =>
      Array.from(articleSources.get(row.article_id) || []).some((sourceId) => sourceIds.has(sourceId))
    )
    return {
      stage,
      sources: sourceIds.size,
      monitored: matched.length,
      qualified: matched.filter((row) => row.report_role === 'evidencia').length,
    }
  })
  return NextResponse.json({
    client_id: id,
    period,
    monitored: rows.length,
    qualified: rows.filter((row) => row.report_role === 'evidencia').length,
    direct_mentions: rows.filter((row) => row.cita_cliente === true).length,
    integral: contentStatuses.filter((status) => status === 'integral').length,
    partial: contentStatuses.filter((status) => status !== 'integral').length,
    pending_topics: topicResult.count || 0,
    source_alerts: sourceAlerts || 0,
    by_intent: byIntent,
    by_cycle_stage: byCycleStage,
  })
}
