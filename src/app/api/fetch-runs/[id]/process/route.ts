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
  // Estas duas escritas são o que torna o run retomável — é delas que depende o
  // workflow poder repetir um lote que deu 504. Falha silenciosa aqui deixaria
  // fontes presas em 'executando' para sempre, e o run nunca fecharia.
  const { error: requeueError } = await supabase
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
  if (requeueError) return NextResponse.json({ error: requeueError.message }, { status: 500 })
  const { error: exhaustedError } = await supabase
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
  if (exhaustedError) return NextResponse.json({ error: exhaustedError.message }, { status: 500 })

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

  // `started_at` aqui é o que data o run para a expiração de run travado
  // (isRunStuck em src/lib/fetch-run-recovery.ts). Se não gravar, o run fica
  // datado só por created_at — ainda expira, mas mais cedo do que deveria.
  const { error: startError } = await supabase
    .from('fetch_runs')
    .update({ status: 'executando', started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pendente')
  if (startError) return NextResponse.json({ error: startError.message }, { status: 500 })

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
  // Só as fontes COM ERRO. Antes isto trazia todas as ~74 linhas do run, com
  // embed de `sources`, em CADA um dos ~19 lotes — payload e tempo de função
  // multiplicados por 19 dentro de um teto de 45 s, que é a causa mais provável
  // dos 504 que matavam o ciclo. O único consumidor (NewsPage.tsx:512) filtra
  // exatamente por `row.error`, então nada se perde na tela.
  const { data: failedSources, error: failedError } = await supabase
    .from('fetch_run_sources')
    .select('*, sources(name, type)')
    .eq('run_id', id)
    .not('error', 'is', null)
  if (failedError) return NextResponse.json({ error: failedError.message }, { status: 500 })
  return NextResponse.json({
    run: { ...run, source_results: failedSources || [] },
    results,
  })
}
