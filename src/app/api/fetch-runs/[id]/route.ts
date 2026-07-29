import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: run, error } = await supabase.from('fetch_runs').select('*').eq('id', id).single()
  if (error || !run) return NextResponse.json({ error: error?.message || 'Execução não encontrada.' }, { status: 404 })
  const { data: sources, error: sourcesError } = await supabase
    .from('fetch_run_sources')
    .select('*, sources(name, type)')
    .eq('run_id', id)
    .order('status', { ascending: true })
    .order('started_at', { ascending: true })
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  return NextResponse.json({ ...run, source_results: sources || [] })
}
