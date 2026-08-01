import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { refreshDraftEvidence } from '@/lib/report-drafts'
import {
  buildDraftChecklist,
  ensureMonthlyDraft,
  syncDraftClusters,
  syncLeadSuggestions,
  syncPeriodComparison,
  syncSourceOperationalAlerts,
} from '@/lib/report-automation'
import type { Client, MonthlyReportDraft } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

const NEXT: Record<string, string> = {
  ensure_draft: 'refresh_base',
  refresh_base: 'clusters',
  clusters: 'triage',
  triage: 'verify',
  verify: 'topics',
  topics: 'lead_suggestions',
  lead_suggestions: 'comparison',
  comparison: 'change_summary',
  change_summary: 'checklist',
  checklist: 'complete',
}

async function finishRunIfNeeded(supabase: ReturnType<typeof createClient>, runId: string) {
  const { data: jobs } = await supabase.from('report_automation_jobs').select('status').eq('run_id', runId)
  const completed = (jobs || []).filter((job) => job.status === 'complete').length
  const failed = (jobs || []).filter((job) => job.status === 'error').length
  const waiting = (jobs || []).filter((job) => job.status === 'waiting_configuration').length
  const terminal = completed + failed + waiting === (jobs || []).length
  await supabase
    .from('report_automation_runs')
    .update({
      completed_jobs: completed,
      failed_jobs: failed,
      status: terminal ? (failed || waiting ? 'partial' : 'complete') : 'running',
      finished_at: terminal ? new Date().toISOString() : null,
    })
    .eq('id', runId)
  return { terminal, completed, failed, waiting }
}

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = createClient()
  const { data: claimed, error: claimError } = await supabase.rpc('claim_report_automation_job')
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  const job = claimed?.[0]
  if (!job) return NextResponse.json({ idle: true })
  const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(req.url).origin
  const headers = { 'Content-Type': 'application/json' }

  try {
    const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', job.client_id).single()
    if (clientError || !client) throw new Error(clientError?.message || 'Cliente não encontrado.')
    let draft: MonthlyReportDraft | null = null
    if (job.draft_id) {
      const { data, error } = await supabase.from('monthly_report_drafts').select('*').eq('id', job.draft_id).single()
      if (error) throw new Error(error.message)
      draft = data as MonthlyReportDraft
    }

    let repeatStage = false
    let processed = 0
    let changed = 0
    let cursor = (job.cursor || {}) as Record<string, unknown>
    if (job.stage === 'ensure_draft') {
      draft = await ensureMonthlyDraft(supabase, client as Client, String(job.period_month).slice(0, 7))
      await supabase.from('report_automation_jobs').update({ draft_id: draft.id }).eq('id', job.id)
    } else if (!draft) {
      throw new Error('Trabalho sem preparação associada.')
    } else if (job.stage === 'refresh_base') {
      const result = await refreshDraftEvidence(supabase, draft)
      draft = result.draft as MonthlyReportDraft
      processed = result.counts.total
      changed = result.changed ? result.delta.added.length + result.delta.removed.length + result.delta.reclassified.length + result.delta.content_changed.length : 0
    } else if (job.stage === 'clusters') {
      processed = (await syncDraftClusters(supabase, draft.id)).length
    } else if (job.stage === 'triage' || job.stage === 'verify') {
      if (!process.env.ANTHROPIC_API_KEY) {
        await Promise.all([
          supabase.from('report_automation_jobs').update({ status: 'waiting_configuration', error: 'ANTHROPIC_API_KEY não configurada.', locked_at: null, updated_at: new Date().toISOString() }).eq('id', job.id),
          supabase.from('monthly_report_drafts').update({ automation_status: 'waiting_configuration', automation_updated_at: new Date().toISOString() }).eq('id', draft.id),
        ])
        const run = await finishRunIfNeeded(supabase, job.run_id)
        return NextResponse.json({ job_id: job.id, stage: job.stage, status: 'waiting_configuration', run })
      }
      const response = await fetch(`${origin}/api/report-drafts/${draft.id}/${job.stage}`, { method: 'POST', headers, cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || `Falha em ${job.stage}.`)
      processed = Number(result.processed || 0)
      repeatStage = !result.complete
    } else if (job.stage === 'topics') {
      const pendingFetchRunId = typeof cursor.topic_fetch_run_id === 'string' ? cursor.topic_fetch_run_id : null
      const pendingTopicId = typeof cursor.topic_id === 'string' ? cursor.topic_id : null
      if (pendingFetchRunId && pendingTopicId) {
        const processResponse = await fetch(`${origin}/api/fetch-runs/${pendingFetchRunId}/process`, { method: 'POST', headers, cache: 'no-store' })
        const processResult = await processResponse.json().catch(() => null)
        if (!processResponse.ok) throw new Error(processResult?.error || 'Falha na busca complementar.')
        const terminal = ['concluido', 'parcial', 'erro'].includes(processResult?.run?.status)
        if (terminal) {
          await refreshDraftEvidence(supabase, draft)
          const afterResponse = await fetch(`${origin}/api/report-drafts/${draft.id}/topics/${pendingTopicId}/search`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ after_fetch: true }),
            cache: 'no-store',
          })
          if (!afterResponse.ok) {
            const result = await afterResponse.json().catch(() => null)
            throw new Error(result?.error || 'Falha ao conferir a busca complementar.')
          }
          cursor = {}
        }
        repeatStage = true
        processed = 1
      } else {
      const today = new Date().toISOString().slice(0, 10)
      const { data: topics } = await supabase.from('monthly_report_topics').select('*').eq('draft_id', draft.id).neq('coverage_status', 'covered').order('position')
      let searched = false
      for (const topic of topics || []) {
        const { count } = await supabase.from('topic_search_runs').select('id', { count: 'exact', head: true }).eq('topic_id', topic.id).gte('created_at', `${today}T00:00:00.000Z`)
        if (count) continue
        const response = await fetch(`${origin}/api/report-drafts/${draft.id}/topics/${topic.id}/search`, { method: 'POST', headers, cache: 'no-store' })
        const result = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(result?.error || `Falha ao buscar o tópico ${topic.title}.`)
        }
        if (result?.fetch_run_id) cursor = { topic_fetch_run_id: result.fetch_run_id, topic_id: topic.id }
        searched = true
        processed = 1
        break
      }
      repeatStage = Boolean(cursor.topic_fetch_run_id) || (searched && (topics || []).length > 1)
      }
    } else if (job.stage === 'lead_suggestions') {
      processed = (await syncLeadSuggestions(supabase, draft)).length
    } else if (job.stage === 'comparison') {
      await syncPeriodComparison(supabase, draft)
      processed = 1
    } else if (job.stage === 'change_summary') {
      const { data: checkpoint } = await supabase.from('report_review_checkpoints').select('*').eq('draft_id', draft.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
      const since = checkpoint?.created_at || '1970-01-01T00:00:00.000Z'
      const [{ data: revisions }, { data: newClusters }, { data: coveredTopics }] = await Promise.all([
        supabase.from('report_base_revisions').select('*').eq('draft_id', draft.id).gt('to_version', checkpoint?.base_version || 0).order('to_version'),
        supabase.from('report_clusters').select('cluster_key, label, article_count, vehicle_count').eq('draft_id', draft.id).gte('created_at', since),
        supabase.from('monthly_report_topics').select('id, title, coverage_status').eq('draft_id', draft.id).eq('coverage_status', 'covered').gte('updated_at', since),
      ])
      const exceptions = await buildDraftChecklist(supabase, draft)
      const summary = {
        checkpoint_at: checkpoint?.created_at || null,
        added: (revisions || []).flatMap((revision) => revision.added || []),
        removed: (revisions || []).flatMap((revision) => revision.removed || []),
        reclassified: (revisions || []).flatMap((revision) => revision.reclassified || []),
        content_changed: (revisions || []).flatMap((revision) => revision.content_changed || []),
        bucket_changes: (revisions || []).flatMap((revision) => revision.bucket_changes || []),
        new_clusters: newClusters || [],
        topics_covered: coveredTopics || [],
        unresolved_checklist_items: exceptions.items.filter((item) => item.status === 'blocked').map((item) => item.key),
        generated_at: new Date().toISOString(),
      }
      await supabase.from('monthly_report_drafts').update({ change_summary: summary }).eq('id', draft.id)
      processed = (revisions || []).length
    } else if (job.stage === 'checklist') {
      const checklist = await buildDraftChecklist(supabase, draft)
      await supabase
        .from('monthly_report_drafts')
        .update({ quality_summary: { ...(draft.quality_summary || {}), approval_checklist: checklist } })
        .eq('id', draft.id)
      await syncSourceOperationalAlerts(supabase)
      processed = 1
    }

    const nextStage = repeatStage ? job.stage : NEXT[job.stage] || 'complete'
    const complete = nextStage === 'complete'
    await Promise.all([
      supabase.from('report_automation_jobs').update({
        stage: nextStage,
        status: complete ? 'complete' : 'pending',
        processed_count: Number(job.processed_count || 0) + processed,
        changed_count: Number(job.changed_count || 0) + changed,
        failure_count: 0,
        cursor,
        locked_at: null,
        finished_at: complete ? new Date().toISOString() : null,
        error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id),
      draft ? supabase.from('monthly_report_drafts').update({ automation_status: complete ? 'complete' : 'running', automation_updated_at: new Date().toISOString() }).eq('id', draft.id) : Promise.resolve(),
    ])
    const run = await finishRunIfNeeded(supabase, job.run_id)
    return NextResponse.json({ job_id: job.id, draft_id: draft?.id, stage: job.stage, next_stage: nextStage, complete, processed, changed, run })
  } catch (automationError) {
    const message = automationError instanceof Error ? automationError.message : 'Falha na automação editorial.'
    const failures = Number(job.failure_count || 0) + 1
    const retry = failures < 3
    await Promise.all([
      supabase.from('report_automation_jobs').update({ status: retry ? 'pending' : 'error', failure_count: failures, error: message, locked_at: null, finished_at: retry ? null : new Date().toISOString(), available_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', job.id),
      job.draft_id ? supabase.from('monthly_report_drafts').update({ automation_status: retry ? 'partial' : 'error', automation_updated_at: new Date().toISOString(), error: message }).eq('id', job.draft_id) : Promise.resolve(),
    ])
    const run = await finishRunIfNeeded(supabase, job.run_id)
    return NextResponse.json({ error: message, job_id: job.id, status: retry ? 'retrying' : 'error', run })
  }
}
