import type { SupabaseClient } from '@supabase/supabase-js'
import { monthBounds, refreshDraftEvidence } from '@/lib/report-drafts'
import {
  buildDraftChecklist,
  ensureMonthlyDraft,
  previousPeriod,
  saoPauloPeriod,
  syncDraftClusters,
  syncLeadSuggestions,
  syncPeriodComparison,
  syncSourceOperationalAlerts,
} from '@/lib/report-automation'
import { SectionGenerationError, generateDraftSection, pendingSectionKeys } from '@/lib/report-section-runner'
import type { Client, MonthlyReportDraft } from '@/types'

/**
 * Máquina de estados da preparação mensal.
 *
 * `quality` aparece duas vezes de propósito: uma antes das seções, para abrir
 * o portão que `generateDraftSection` exige, e outra depois delas
 * (`quality_final`) para que a auditoria de rastreabilidade e o lint de
 * diretrizes rodem sobre a prosa real, não sobre seções vazias.
 *
 * `park` é a única parada humana: dali o job sai da fila até alguém resolver
 * as exceções e confirmar indicadores e matéria principal.
 */
const NEXT: Record<string, string> = {
  ensure_draft: 'refresh_base',
  refresh_base: 'clusters',
  clusters: 'triage',
  triage: 'verify',
  verify: 'topics',
  topics: 'lead_suggestions',
  lead_suggestions: 'auto_lead',
  auto_lead: 'comparison',
  comparison: 'change_summary',
  change_summary: 'quality',
  quality: 'checklist',
  checklist: 'park',
  park: 'complete',
  sections: 'quality_final',
  quality_final: 'complete',
}

export const AUTOMATION_STAGES = Object.keys(NEXT)

/** Itens do checklist que só uma pessoa pode resolver. */
const HUMAN_BLOCKING_KEYS = ['exceptions', 'agenda', 'lead', 'service_metrics'] as const

/** Ordem de prioridade ao reportar por que a automação parou. */
const BLOCKING_PRIORITY = ['exceptions', 'lead', 'service_metrics', 'agenda'] as const

/** Não reprocessar (nem regastar tokens) um draft concluído há pouco. */
const CLIENT_COOLDOWN_MS = 10 * 60 * 1000

export type StartAutomationOptions = {
  period?: string
  trigger?: string
  includePrevious?: boolean
  clientIds?: string[]
  autoSections?: boolean
}

export async function startAutomationRun(supabase: SupabaseClient, options: StartAutomationOptions = {}) {
  const period = /^\d{4}-\d{2}$/.test(options.period || '') ? (options.period as string) : saoPauloPeriod()
  const trigger = ['schedule', 'manual', 'backfill'].includes(options.trigger || '') ? (options.trigger as string) : 'schedule'
  const includePrevious = options.includePrevious !== false
  const clientIds = options.clientIds?.length ? options.clientIds : null

  // Um run por período já em andamento é reaproveitado: dois cliques em
  // "Preparar mês" não podem bifurcar a fila. 'partial' entra junto porque um
  // run parado por revisão humana continua sendo o run corrente do mês.
  // Erro engolido aqui devolvia `null` e criava um run DUPLICADO, anulando
  // justamente a proteção contra duplo clique documentada acima.
  const { data: activeRun, error: activeRunError } = await supabase
    .from('report_automation_runs')
    .select('*')
    .eq('period_month', monthBounds(period).date)
    .in('status', ['running', 'partial'])
    .gte('requested_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (activeRunError) throw new Error(activeRunError.message)
  if (activeRun) {
    return { run_id: activeRun.id, jobs: activeRun.total_jobs, period, reused: true }
  }

  let clientQuery = supabase.from('clients').select('*').eq('active', true).order('name')
  if (clientIds) clientQuery = clientQuery.in('id', clientIds)
  const { data: clients, error: clientError } = await clientQuery
  if (clientError) throw new Error(clientError.message)

  // Cooldown por cliente: drafts concluídos há menos de 10 minutos não voltam
  // para a fila, para um operador impaciente não repetir os estágios de IA.
  // Erro engolido aqui esvaziava o conjunto de cooldown, reenfileirando todos
  // os clientes pelos estágios pagos de IA.
  const { data: recentDrafts, error: recentDraftsError } = await supabase
    .from('monthly_report_drafts')
    .select('client_id, automation_status, automation_updated_at')
    .eq('period_month', monthBounds(period).date)
    .eq('automation_status', 'complete')
    .gte('automation_updated_at', new Date(Date.now() - CLIENT_COOLDOWN_MS).toISOString())
  if (recentDraftsError) throw new Error(recentDraftsError.message)
  const cooling = new Set((recentDrafts || []).map((draft) => draft.client_id))
  const eligible = (clients || []).filter((client) => !cooling.has(client.id))
  if (!eligible.length) {
    return { run_id: null, jobs: 0, period, skipped: cooling.size, reused: false }
  }

  const { data: run, error: runError } = await supabase
    .from('report_automation_runs')
    .insert({
      trigger,
      period_month: monthBounds(period).date,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: { include_previous: includePrevious, auto_sections: Boolean(options.autoSections), scoped: Boolean(clientIds) },
    })
    .select()
    .single()
  if (runError || !run) throw new Error(runError?.message || 'Falha ao iniciar automação.')

  const jobs = eligible.map((client) => ({
    run_id: run.id,
    client_id: client.id,
    period_month: monthBounds(period).date,
    stage: 'ensure_draft',
  }))
  if (includePrevious) {
    const prior = previousPeriod(period)
    let priorQuery = supabase
      .from('monthly_report_drafts')
      .select('id, client_id, period_month')
      .eq('period_month', monthBounds(prior).date)
      .neq('status', 'approved')
    if (clientIds) priorQuery = priorQuery.in('client_id', clientIds)
    const { data: priorDrafts } = await priorQuery
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
    throw new Error(jobsError.message)
  }
  await supabase.from('report_automation_runs').update({ total_jobs: jobs.length }).eq('id', run.id)

  // auto_sections NÃO é gravado aqui: num mês novo os rascunhos ainda não
  // existem e o update pegaria zero linhas. A flag viaja em run.metadata e é
  // aplicada ao rascunho no estágio ensure_draft, quando ele já existe.
  return { run_id: run.id, jobs: jobs.length, period, include_previous: includePrevious, skipped: cooling.size }
}

async function finishRunIfNeeded(supabase: SupabaseClient, runId: string) {
  // `error` é obrigatório aqui, e propaga. Sem ele, uma falha de banco deixava
  // `jobs` nulo, então completed = failed = waiting = 0 e
  // `terminal = 0 + 0 + 0 === 0` era TRUE: o run inteiro do mês era carimbado
  // 'complete', com finished_at, sem nada ter sido feito. Falha barulhenta é
  // melhor que mês vazio entregue como pronto.
  const { data: jobs, error: jobsError } = await supabase
    .from('report_automation_jobs')
    .select('status')
    .eq('run_id', runId)
  if (jobsError) throw new Error(`Falha ao apurar o estado do run: ${jobsError.message}`)
  const completed = (jobs || []).filter((job) => job.status === 'complete').length
  const failed = (jobs || []).filter((job) => job.status === 'error').length
  // 'waiting_review' conta como terminal: o run acabou o que era da máquina.
  // Sem isso, um run parado em revisão humana ficaria 'running' para sempre e
  // bloquearia o próximo start pela reutilização de run ativo.
  const waiting = (jobs || []).filter((job) => ['waiting_configuration', 'waiting_review'].includes(job.status)).length
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

export type ProcessAutomationOptions = {
  origin: string
  runId?: string | null
  clientId?: string | null
  /** Devolve jobs parqueados para a fila antes de reclamar. Ver resumeParkedJobs. */
  resume?: boolean
}

/**
 * Um job parqueado fica com status 'waiting_review' / 'waiting_configuration',
 * que o claim (só 'pending' ou 'running' expirado) nunca reclama. Sem esta
 * despausa explícita, "Continuar" depois de limpar a fila de exceções não faria
 * nada: o laço receberia { idle: true } no primeiro tick.
 *
 * É explícito de propósito — despausar a cada tick faria o laço girar contra um
 * job que a máquina acabou de parquear.
 */
async function resumeParkedJobs(supabase: SupabaseClient, scope: { runId?: string | null; clientId?: string | null }) {
  let query = supabase
    .from('report_automation_jobs')
    .update({
      status: 'pending',
      available_at: new Date().toISOString(),
      locked_at: null,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .in('status', ['waiting_review', 'waiting_configuration'])
  if (scope.clientId) query = query.eq('client_id', scope.clientId)
  if (scope.runId) query = query.eq('run_id', scope.runId)
  const { data, error } = await query.select('draft_id')
  // Sem isto, uma falha devolvia 0 e o operador via "nada estava parqueado"
  // quando na verdade a despausa não aconteceu.
  if (error) throw new Error(`Falha ao despausar jobs: ${error.message}`)
  const draftIds = (data || []).map((job) => job.draft_id).filter(Boolean)
  if (draftIds.length) {
    await supabase
      .from('monthly_report_drafts')
      .update({ automation_status: 'running', automation_blocking_reason: null, automation_updated_at: new Date().toISOString() })
      .in('id', draftIds)
  }
  return draftIds.length
}

export async function processNextAutomationJob(supabase: SupabaseClient, options: ProcessAutomationOptions) {
  const { origin } = options
  if (options.resume) {
    await resumeParkedJobs(supabase, { runId: options.runId, clientId: options.clientId })
  }
  const { data: claimed, error: claimError } = await supabase.rpc('claim_report_automation_job', {
    p_client_id: options.clientId || null,
    p_run_id: options.runId || null,
  })
  if (claimError) throw new Error(claimError.message)
  const job = claimed?.[0]
  if (!job) return { idle: true as const }
  const headers = { 'Content-Type': 'application/json' }

  const park = async (draftId: string, status: 'waiting_configuration' | 'waiting_review', reason: string | null, message: string) => {
    await Promise.all([
      supabase
        .from('report_automation_jobs')
        .update({ status, error: message, locked_at: null, updated_at: new Date().toISOString() })
        .eq('id', job.id),
      supabase
        .from('monthly_report_drafts')
        .update({ automation_status: status, automation_blocking_reason: reason, automation_updated_at: new Date().toISOString() })
        .eq('id', draftId),
    ])
    const run = await finishRunIfNeeded(supabase, job.run_id)
    return { job_id: job.id, draft_id: draftId, stage: job.stage, status, blocking_reason: reason, run }
  }

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
    let nextOverride: string | null = null
    let processed = 0
    let changed = 0
    let cursor = (job.cursor || {}) as Record<string, unknown>

    if (job.stage === 'ensure_draft') {
      draft = await ensureMonthlyDraft(supabase, client as Client, String(job.period_month).slice(0, 7))
      const { data: run } = await supabase
        .from('report_automation_runs')
        .select('metadata')
        .eq('id', job.run_id)
        .maybeSingle()
      const autoSections = Boolean((run?.metadata as { auto_sections?: boolean } | null)?.auto_sections)
      await Promise.all([
        supabase.from('report_automation_jobs').update({ draft_id: draft.id }).eq('id', job.id),
        // Só liga; nunca desliga um opt-in já feito no rascunho.
        autoSections && !draft.auto_sections
          ? supabase.from('monthly_report_drafts').update({ auto_sections: true }).eq('id', draft.id)
          : Promise.resolve(),
      ])
      if (autoSections) draft = { ...draft, auto_sections: true }
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
      if (job.stage === 'verify' && !process.env.ANTHROPIC_API_KEY) {
        return await park(draft.id, 'waiting_configuration', null, 'ANTHROPIC_API_KEY não configurada.')
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
    } else if (job.stage === 'auto_lead') {
      // A máquina só preenche o slot; quem promove para 'humano' é a pessoa,
      // via POST /lead. Nunca chamar aquela rota daqui: ela carimba
      // report_role_source='humano' e editorial_review_state='revisado' no
      // artigo, o que forjaria atestação humana e ainda satisfaria
      // silenciosamente a fila de exceções para aquele item.
      if (!draft.lead_article_id) {
        const { data: suggestion } = await supabase
          .from('report_lead_suggestions')
          .select('article_id')
          .eq('draft_id', draft.id)
          .eq('base_version', draft.base_version)
          .order('rank')
          .limit(1)
          .maybeSingle()
        if (suggestion?.article_id) {
          await supabase
            .from('monthly_report_drafts')
            .update({
              lead_article_id: suggestion.article_id,
              lead_source: 'sugestao',
              lead_suggested_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', draft.id)
          draft = { ...draft, lead_article_id: suggestion.article_id, lead_source: 'sugestao' } as MonthlyReportDraft
          processed = 1
        }
      }
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
    } else if (job.stage === 'quality' || job.stage === 'quality_final') {
      const response = await fetch(`${origin}/api/report-drafts/${draft.id}/quality`, { method: 'POST', headers, cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'Falha nos portões de qualidade.')
      processed = 1
      const { data: refreshed } = await supabase.from('monthly_report_drafts').select('*').eq('id', draft.id).single()
      if (refreshed) draft = refreshed as MonthlyReportDraft
    } else if (job.stage === 'checklist') {
      const checklist = await buildDraftChecklist(supabase, draft)
      await supabase
        .from('monthly_report_drafts')
        .update({ quality_summary: { ...(draft.quality_summary || {}), approval_checklist: checklist } })
        .eq('id', draft.id)
      await syncSourceOperationalAlerts(supabase)
      processed = 1
    } else if (job.stage === 'park') {
      // Única parada humana. `requirePackage: false` porque o pacote é gerado
      // quando o operador clica em "Baixar pacote" — não é pendência daqui.
      const checklist = await buildDraftChecklist(supabase, draft, { requirePackage: false })
      const blocked = new Set(checklist.items.filter((item) => item.status === 'blocked').map((item) => item.key))
      const blockedHuman = BLOCKING_PRIORITY.filter(
        (key) => blocked.has(key) && (HUMAN_BLOCKING_KEYS as readonly string[]).includes(key)
      )
      // Indicadores herdados e matéria principal apenas sugerida são 'warning':
      // não travam o checklist. Mas quando há seções para gerar, é aqui que se
      // pergunta — confirmar depois das nove seções significaria regerar as
      // nove. Sem auto_sections não há token em jogo, então não se pergunta:
      // parar o cron diário em todo cliente seria só ruído.
      const confirmations = draft.auto_sections
        ? BLOCKING_PRIORITY.filter(
            (key) =>
              !blocked.has(key) &&
              ((key === 'lead' && Boolean(draft?.lead_article_id) && draft?.lead_source !== 'humano') ||
                (key === 'service_metrics' && draft?.service_metrics_source !== 'humano'))
          )
        : []
      const pendingHuman = BLOCKING_PRIORITY.filter(
        (key) => blockedHuman.includes(key) || confirmations.includes(key)
      )
      if (pendingHuman.length) {
        const detail = checklist.items.find((item) => item.key === pendingHuman[0])?.detail
        return await park(
          draft.id,
          'waiting_review',
          pendingHuman[0],
          detail ? `Aguardando revisão: ${detail}` : `Aguardando revisão humana (${pendingHuman.join(', ')}).`
        )
      }
      processed = 1
      if (draft.auto_sections) {
        if (draft.lead_article_id && draft.quality_status === 'passed') {
          nextOverride = 'sections'
        } else {
          // Pendência que nenhuma pessoa resolve num clique (qualidade, base,
          // citações): parqueia com o motivo para o card apontar a preparação.
          const rest = Array.from(blocked).filter((key) => !(HUMAN_BLOCKING_KEYS as readonly string[]).includes(key))
          return await park(
            draft.id,
            'waiting_review',
            'quality',
            rest.length ? `Pendências antes das seções: ${rest.join(', ')}.` : 'Portões de qualidade não aprovados.'
          )
        }
      }
    } else if (job.stage === 'sections') {
      if (!process.env.ANTHROPIC_API_KEY) {
        return await park(draft.id, 'waiting_configuration', null, 'ANTHROPIC_API_KEY não configurada.')
      }
      const pending = await pendingSectionKeys(supabase, draft.id)
      if (!pending.length) {
        processed = 0
      } else {
        // Uma seção por invocação: cada uma é uma chamada ao modelo e o limite
        // de função da Vercel é de 60s. `repeatStage` é o mesmo idioma que
        // triage/verify/topics já usam.
        await generateDraftSection(supabase, draft.id, pending[0])
        cursor = { ...cursor, section_key: pending[0] }
        processed = 1
        repeatStage = pending.length > 1
      }
    }

    const nextStage = repeatStage ? job.stage : nextOverride || NEXT[job.stage] || 'complete'
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
      draft
        ? supabase.from('monthly_report_drafts').update({
            automation_status: complete ? 'complete' : 'running',
            automation_blocking_reason: null,
            automation_updated_at: new Date().toISOString(),
          }).eq('id', draft.id)
        : Promise.resolve(),
    ])
    const run = await finishRunIfNeeded(supabase, job.run_id)
    return { job_id: job.id, draft_id: draft?.id, stage: job.stage, next_stage: nextStage, complete, processed, changed, run }
  } catch (automationError) {
    const message = automationError instanceof Error ? automationError.message : 'Falha na automação editorial.'
    // Falta de configuração não gasta tentativa: parqueia para o operador ver.
    if (automationError instanceof SectionGenerationError && automationError.status === 503 && job.draft_id) {
      return await park(job.draft_id, 'waiting_configuration', null, message)
    }
    const failures = Number(job.failure_count || 0) + 1
    const retry = failures < 3
    // Backoff exponencial. Antes gravava-se `available_at = now`, então um loop
    // de tick no navegador queimava as três tentativas em sequência contra o
    // que estivesse falhando (429 da Anthropic, timeout do Supabase).
    const backoffMinutes = Math.min(2 ** failures, 8)
    const availableAt = new Date(Date.now() + (retry ? backoffMinutes * 60_000 : 0)).toISOString()
    await Promise.all([
      supabase.from('report_automation_jobs').update({
        status: retry ? 'pending' : 'error',
        failure_count: failures,
        error: message,
        locked_at: null,
        finished_at: retry ? null : new Date().toISOString(),
        available_at: availableAt,
        updated_at: new Date().toISOString(),
      }).eq('id', job.id),
      job.draft_id
        ? supabase.from('monthly_report_drafts').update({ automation_status: retry ? 'partial' : 'error', automation_updated_at: new Date().toISOString(), error: message }).eq('id', job.draft_id)
        : Promise.resolve(),
    ])
    const run = await finishRunIfNeeded(supabase, job.run_id)
    return { error: message, job_id: job.id, status: retry ? 'retrying' : 'error', retry_at: retry ? availableAt : null, run }
  }
}
