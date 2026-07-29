import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const COOLDOWN_MS = 10 * 60 * 1000

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('fetch_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))
  const triggerType = body?.trigger_type === 'schedule' ? 'schedule' : 'manual'

  const { data: active, error: activeError } = await supabase
    .from('fetch_runs')
    .select('*')
    .in('status', ['pendente', 'executando'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (activeError) {
    const migrationMissing = activeError.message.includes('fetch_runs')
    return NextResponse.json(
      {
        error: migrationMissing
          ? 'A migration 025 precisa ser aplicada antes da coleta rastreável.'
          : activeError.message,
      },
      { status: migrationMissing ? 503 : 500 }
    )
  }
  if (active) return NextResponse.json({ run: active, reused: true })

  const { data: latest } = await supabase
    .from('fetch_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest?.finished_at && Date.now() - new Date(latest.finished_at).getTime() < COOLDOWN_MS) {
    return NextResponse.json({ run: latest, reused: true, cooldown: true })
  }

  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id')
    .eq('active', true)
    .order('priority', { ascending: false })
    .order('name', { ascending: true })
  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 })
  if (!sources?.length) return NextResponse.json({ error: 'Nenhuma fonte ativa.' }, { status: 400 })

  const { data: run, error: runError } = await supabase
    .from('fetch_runs')
    .insert({ trigger_type: triggerType, total_sources: sources.length })
    .select()
    .single()
  if (runError || !run) {
    if (runError?.code === '23505') {
      const { data: concurrent } = await supabase
        .from('fetch_runs')
        .select('*')
        .in('status', ['pendente', 'executando'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (concurrent) return NextResponse.json({ run: concurrent, reused: true })
    }
    return NextResponse.json(
      { error: runError?.message || 'Falha ao iniciar coleta.' },
      { status: 500 }
    )
  }

  const { error: queueError } = await supabase.from('fetch_run_sources').insert(
    sources.map((source) => ({
      run_id: run.id,
      source_id: source.id,
    }))
  )
  if (queueError) {
    await supabase.from('fetch_runs').update({ status: 'erro', finished_at: new Date().toISOString() }).eq('id', run.id)
    return NextResponse.json({ error: queueError.message }, { status: 500 })
  }
  return NextResponse.json({ run }, { status: 201 })
}
