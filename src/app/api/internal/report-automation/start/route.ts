import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { monthBounds } from '@/lib/report-drafts'
import { previousPeriod, saoPauloPeriod } from '@/lib/report-automation'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const period = /^\d{4}-\d{2}$/.test(body?.period || '') ? body.period : saoPauloPeriod()
  const trigger = ['schedule', 'manual', 'backfill'].includes(body?.trigger) ? body.trigger : 'schedule'
  const includePrevious = body?.include_previous !== false
  const supabase = createClient()
  const { data: activeRun } = await supabase
    .from('report_automation_runs')
    .select('*')
    .eq('period_month', monthBounds(period).date)
    .eq('status', 'running')
    .gte('requested_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (activeRun) {
    return NextResponse.json({ run_id: activeRun.id, jobs: activeRun.total_jobs, period, reused: true })
  }
  const { data: clients, error: clientError } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('name')
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })

  const { data: run, error: runError } = await supabase
    .from('report_automation_runs')
    .insert({
      trigger,
      period_month: monthBounds(period).date,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: { include_previous: includePrevious },
    })
    .select()
    .single()
  if (runError || !run) return NextResponse.json({ error: runError?.message || 'Falha ao iniciar automação.' }, { status: 500 })

  const jobs = (clients || []).map((client) => ({
    run_id: run.id,
    client_id: client.id,
    period_month: monthBounds(period).date,
    stage: 'ensure_draft',
  }))
  if (includePrevious) {
    const prior = previousPeriod(period)
    const { data: priorDrafts } = await supabase
      .from('monthly_report_drafts')
      .select('id, client_id, period_month')
      .eq('period_month', monthBounds(prior).date)
      .neq('status', 'approved')
    const known = new Set(jobs.map((job) => `${job.client_id}:${job.period_month}`))
    for (const draft of priorDrafts || []) {
      const key = `${draft.client_id}:${draft.period_month}`
      if (known.has(key)) continue
      known.add(key)
      jobs.push({ run_id: run.id, client_id: draft.client_id, period_month: draft.period_month, stage: 'ensure_draft' })
    }
  }
  const { error: jobsError } = await supabase.from('report_automation_jobs').insert(jobs)
  if (jobsError) {
    await supabase.from('report_automation_runs').update({ status: 'error', error: jobsError.message }).eq('id', run.id)
    return NextResponse.json({ error: jobsError.message }, { status: 500 })
  }
  await supabase.from('report_automation_runs').update({ total_jobs: jobs.length }).eq('id', run.id)
  return NextResponse.json({ run_id: run.id, jobs: jobs.length, period, include_previous: includePrevious }, { status: 201 })
}
