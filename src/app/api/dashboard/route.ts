import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import type { Client, DashboardClientSummary, Source } from '@/types'

export const dynamic = 'force-dynamic'

async function monitoredCount(
  supabase: ReturnType<typeof createClient>,
  clientId: string,
  start: string,
  end?: string,
  filter?: 'direct' | 'review'
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

  const [{ data: clientRows, error: clientsError }, { data: sourceRows, error: sourcesError }] = await Promise.all([
    supabase.from('clients').select('*').eq('active', true).order('name', { ascending: true }),
    supabase.from('sources').select('*').eq('active', true),
  ])
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })

  try {
    const clients: DashboardClientSummary[] = await Promise.all(
      ((clientRows as Client[]) || []).map(async (client) => {
        const [total, direct, review, previous] = await Promise.all([
          monitoredCount(supabase, client.id, cutoff),
          monitoredCount(supabase, client.id, cutoff, undefined, 'direct'),
          monitoredCount(supabase, client.id, cutoff, undefined, 'review'),
          monitoredCount(supabase, client.id, previousStart, cutoff),
        ])
        return {
          client,
          total,
          direct_mentions: direct,
          review_count: review,
          previous_total: previous,
          variation_percent: previous > 0 ? Math.round(((total - previous) / previous) * 1000) / 10 : null,
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
    const failed = sources.filter((source) => !!source.last_fetch_error || (source.last_fetched_at && !source.last_fetch_count))
    const { data: latestRun } = await supabase
      .from('fetch_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
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
        healthy_sources: sources.length - new Set([...never, ...stale, ...failed].map((source) => source.id)).size,
        stale_sources: stale.length,
        failed_sources: failed.length,
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
