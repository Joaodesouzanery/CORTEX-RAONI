import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import type { Client, DashboardClientSummary, Source } from '@/types'

export const dynamic = 'force-dynamic'

async function monitoredCount(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  start: string,
  end?: string,
  filter?: 'direct' | 'review' | 'triaged' | 'qualified' | 'annex' | 'pending'
): Promise<number> {
  let query = supabase
    .from('article_client_tags')
    .select('article_id, articles!inner(published_at)', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .neq('monitoring_status', 'excluido')
    .gte('articles.published_at', start)
  if (end) query = query.lt('articles.published_at', end)
  if (filter === 'direct') query = query.eq('cita_cliente', true)
  if (filter === 'review') query = query.eq('monitoring_status', 'revisao')
  if (filter === 'triaged') {
    query = query.or('triaged_at.not.is.null,report_role_source.eq.humano')
  }
  if (filter === 'qualified') {
    query = query
      .eq('report_role', 'evidencia')
      .or(
        'report_role_source.eq.humano,editorial_review_state.eq.revisado,and(verification_status.eq.verificada,qa_checked_at.not.is.null,editorial_confidence.gte.0.85)'
      )
  }
  if (filter === 'annex') query = query.in('report_role', ['contexto', 'ruido'])
  if (filter === 'pending') {
    query = query.or('report_role.is.null,editorial_review_state.eq.pendente')
  }
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count || 0
}

export async function GET(req: Request) {
  const supabase = createClient()
  const parsedDays = Number.parseInt(new URL(req.url).searchParams.get('days') || '30')
  const days = [7, 15, 30].includes(parsedDays) ? parsedDays : 30
  const now = new Date()
  const cutoff = new Date(now.getTime() - days * 86400000).toISOString()
  const previousStart = new Date(now.getTime() - days * 2 * 86400000).toISOString()
  const currentPeriod = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .slice(0, 7)
  const currentPeriodDate = `${currentPeriod}-01`

  const [{ data: clientRows, error: clientsError }, { data: sourceRows, error: sourcesError }] = await Promise.all([
    supabase.from('clients').select('*').eq('active', true).order('name', { ascending: true }),
    supabase.from('sources').select('*').eq('active', true),
  ])
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })

  try {
    const clients: DashboardClientSummary[] = await Promise.all(
      ((clientRows as Client[]) || []).map(async (client) => {
        const [total, direct, review, previous, triaged, qualified, annex, pending, draftResult] = await Promise.all([
          monitoredCount(supabase, client.id, cutoff),
          monitoredCount(supabase, client.id, cutoff, undefined, 'direct'),
          monitoredCount(supabase, client.id, cutoff, undefined, 'review'),
          monitoredCount(supabase, client.id, previousStart, cutoff),
          monitoredCount(supabase, client.id, cutoff, undefined, 'triaged'),
          monitoredCount(supabase, client.id, cutoff, undefined, 'qualified'),
          monitoredCount(supabase, client.id, cutoff, undefined, 'annex'),
          monitoredCount(supabase, client.id, cutoff, undefined, 'pending'),
          supabase
            .from('monthly_report_drafts')
            .select('id, quality_status, status, automation_status')
            .eq('client_id', client.id)
            .eq('period_month', currentPeriodDate)
            .neq('status', 'approved')
            .order('version', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        const readinessDraft = draftResult.data
        let readiness = {
          draft_id: readinessDraft?.id || null,
          period: currentPeriod,
          verified_evidence: 0,
          qualified_evidence: 0,
          pending_exceptions: 0,
          covered_topics: 0,
          required_topics: 0,
          recognized_gaps: 0,
          ready: false,
          automation_status: null,
          automation_error: null,
        }
        if (readinessDraft) {
          const stuck = ['waiting_configuration', 'error'].includes(readinessDraft.automation_status)
          const [{ data: evidenceRows }, { data: topicRows }, { count: reviewQueue }, { data: latestJob }] = await Promise.all([
            supabase
              .from('report_evidence_items')
              .select('bucket, classification_snapshot')
              .eq('draft_id', readinessDraft.id),
            supabase
              .from('monthly_report_topics')
              .select('required, coverage_status, gap_acknowledged_at')
              .eq('draft_id', readinessDraft.id),
            supabase
              .from('report_evidence_items')
              .select('id', { count: 'exact', head: true })
              .eq('draft_id', readinessDraft.id)
              .neq('bucket', 'excluded')
              .eq('classification_snapshot->>editorial_review_state', 'pendente'),
            stuck
              ? supabase
                  .from('report_automation_jobs')
                  .select('error')
                  .eq('draft_id', readinessDraft.id)
                  .not('error', 'is', null)
                  .order('updated_at', { ascending: false })
                  .limit(1)
                  .maybeSingle()
              : Promise.resolve({ data: null }),
          ])
          const qualifiedRows = (evidenceRows || []).filter((item) => item.bucket === 'qualified')
          const requiredRows = (topicRows || []).filter((topic) => topic.required)
          readiness = {
            draft_id: readinessDraft.id,
            period: currentPeriod,
            verified_evidence: qualifiedRows.filter((item) => {
              const classification = item.classification_snapshot as Record<string, unknown>
              return classification.editorial_review_state === 'revisado' ||
                (classification.verification_status === 'verificada' && Boolean(classification.qa_checked_at))
            }).length,
            qualified_evidence: qualifiedRows.length,
            pending_exceptions: reviewQueue || 0,
            covered_topics: requiredRows.filter((topic) => topic.coverage_status === 'covered').length,
            required_topics: requiredRows.length,
            recognized_gaps: requiredRows.filter((topic) => topic.coverage_status === 'gap' && topic.gap_acknowledged_at).length,
            ready: readinessDraft.quality_status === 'passed',
            automation_status: readinessDraft.automation_status,
            automation_error: latestJob?.error || null,
          }
        }
        return {
          client,
          total,
          triaged_count: triaged,
          qualified_count: qualified,
          annex_count: annex,
          pending_count: pending,
          direct_mentions: direct,
          review_count: review,
          previous_total: previous,
          variation_percent: previous > 0 ? Math.round(((total - previous) / previous) * 1000) / 10 : null,
          readiness,
        }
      })
    )

    const sources = (sourceRows as Source[]) || []
    const staleThreshold = now.getTime() - 8 * 60 * 60 * 1000
    const never = sources.filter((source) => !source.last_fetched_at)
    const stale = sources.filter(
      (source) =>
        (source.last_success_at || source.last_fetched_at) &&
        new Date((source.last_success_at || source.last_fetched_at)!).getTime() < staleThreshold
    )
    const failed = sources.filter((source) => !!source.last_fetch_error)
    const empty = sources.filter(
      (source) => !source.last_fetch_error && !!source.last_fetched_at && source.last_fetch_count === 0
    )
    const [{ data: latestRun }, { data: operationalAlerts }] = await Promise.all([
      supabase
        .from('fetch_runs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('operational_alerts')
        .select('*')
        .neq('status', 'resolved')
        .order('severity', { ascending: true })
        .order('last_seen_at', { ascending: false })
        .limit(50),
    ])
    const { data: oldest } = await supabase
      .from('articles')
      .select('published_at')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    const { count: olderCount } = await supabase
      .from('articles')
      .select('id', { count: 'exact', head: true })
      .lt('published_at', cutoff)

    return NextResponse.json({
      period_days: days,
      generated_at: now.toISOString(),
      clients: clients.sort((a, b) => b.total - a.total),
      health: {
        active_sources: sources.length,
        healthy_sources:
          sources.length - new Set([...never, ...stale, ...failed, ...empty].map((source) => source.id)).size,
        stale_sources: stale.length,
        failed_sources: failed.length,
        empty_sources: empty.length,
        never_fetched_sources: never.length,
        last_success_at:
          sources
            .map((source) => source.last_success_at || source.last_fetched_at)
            .filter(Boolean)
            .sort()
            .at(-1) || null,
        coverage_start: oldest?.published_at || null,
        coverage_complete: (olderCount || 0) > 0,
        latest_run: latestRun || null,
      },
      operational_alerts: operationalAlerts || [],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao montar o painel.'
    const migrationMissing =
      message.includes('monitoring_status') || message.includes('fetch_runs') || message.includes('client_relevance_rules')
    return NextResponse.json(
      { error: migrationMissing ? 'A migration 025 precisa ser aplicada para o novo Painel.' : message },
      { status: migrationMissing ? 503 : 500 }
    )
  }
}
