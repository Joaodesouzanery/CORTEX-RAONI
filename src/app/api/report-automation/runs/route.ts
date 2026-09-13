import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { monthBounds } from '@/lib/report-drafts'
import { saoPauloPeriod } from '@/lib/report-automation'
import { startAutomationRun } from '@/lib/report-automation-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

/**
 * Gêmea de /api/internal/report-automation/start, sem CRON_SECRET.
 *
 * O Painel não pode usar a rota interna: o middleware devolve 503 nela quando
 * CRON_SECRET não está configurado, o que tornaria o cockpit intestável
 * localmente. Mesma postura de autenticação do resto do app.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const clientIds = Array.isArray(body?.client_ids)
    ? body.client_ids.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    : undefined
  try {
    const result = await startAutomationRun(createClient(), {
      period: body?.period,
      trigger: 'manual',
      includePrevious: body?.include_previous === true,
      clientIds,
      // Do Painel, o objetivo é chegar ao pacote — as seções entram no fluxo.
      autoSections: body?.auto_sections !== false,
    })
    return NextResponse.json(result, { status: result.reused || !result.run_id ? 200 : 201 })
  } catch (startError) {
    const message = startError instanceof Error ? startError.message : 'Falha ao iniciar automação.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Estado do run corrente do período, por cliente, para a barra de progresso. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const period = /^\d{4}-\d{2}$/.test(params.get('period') || '') ? (params.get('period') as string) : saoPauloPeriod()
  const runId = params.get('run_id')
  const supabase = createClient()

  let run
  if (runId) {
    const { data } = await supabase.from('report_automation_runs').select('*').eq('id', runId).maybeSingle()
    run = data
  } else {
    const { data } = await supabase
      .from('report_automation_runs')
      .select('*')
      .eq('period_month', monthBounds(period).date)
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    run = data
  }
  if (!run) return NextResponse.json({ run: null, jobs: [], period })

  const { data: jobs, error } = await supabase
    .from('report_automation_jobs')
    .select('id, client_id, draft_id, stage, status, error, processed_count, available_at, updated_at, clients(name)')
    .eq('run_id', run.id)
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ run, jobs: jobs || [], period })
}
