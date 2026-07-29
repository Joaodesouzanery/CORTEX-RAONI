import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { processFetchSource, refreshFetchRun } from '@/lib/fetch-run'
import type { Source } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const staleBefore = new Date(Date.now() - 90_000).toISOString()
  await supabase
    .from('fetch_run_sources')
    .update({
      status: 'pendente',
      error: 'Lote interrompido; nova tentativa automática.',
      started_at: null,
    })
    .eq('run_id', id)
    .eq('status', 'executando')
    .lt('started_at', staleBefore)
    .lt('attempt_count', 2)
  await supabase
    .from('fetch_run_sources')
    .update({
      status: 'erro',
      error: 'Fonte excedeu duas tentativas após interrupção do lote.',
      finished_at: new Date().toISOString(),
    })
    .eq('run_id', id)
    .eq('status', 'executando')
    .lt('started_at', staleBefore)
    .gte('attempt_count', 2)

  const { data: claimed, error: claimError } = await supabase.rpc('claim_fetch_run_sources', {
    p_run_id: id,
    p_limit: 4,
  })
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  const claimedRows =
    (claimed as Array<{ source_id: string; attempt_count: number }>) || []
  const ids = claimedRows.map((row) => row.source_id)
  if (!ids.length) {
    const run = await refreshFetchRun(supabase, id)
    return NextResponse.json({ run, results: [] })
  }

  await supabase
    .from('fetch_runs')
    .update({ status: 'executando', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pendente')

  const { data: sourceRows, error: sourcesError } = await supabase.from('sources').select('*').in('id', ids)
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  const byId = new Map(((sourceRows as Source[]) || []).map((source) => [source.id, source]))
  const sources = ids.map((sourceId) => byId.get(sourceId)).filter(Boolean) as Source[]
  const attempts = new Map(
    claimedRows.map((row) => [row.source_id, row.attempt_count])
  )
  const results = await Promise.all(
    sources.map((source) =>
      processFetchSource(supabase, id, source, attempts.get(source.id) || 1)
    )
  )
  const run = await refreshFetchRun(supabase, id)
  const { data: sourceResults } = await supabase
    .from('fetch_run_sources')
    .select('*, sources(name, type)')
    .eq('run_id', id)
    .order('status', { ascending: true })
    .order('started_at', { ascending: true })
  return NextResponse.json({
    run: { ...run, source_results: sourceResults || [] },
    results,
  })
}
