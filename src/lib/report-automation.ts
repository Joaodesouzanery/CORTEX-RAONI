import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ApprovalChecklist,
  Client,
  LeadSuggestion,
  MonthlyReportDraft,
  PeriodComparison,
  ReportCluster,
  ReportSection,
} from '@/types'
import { monthBounds, refreshDraftEvidence, reportBrand, reportEvidenceItems } from '@/lib/report-drafts'
import {
  approvalChecklist,
  buildReportClusters,
  comparePeriods,
  exceptionPriority,
  leadSuggestions,
} from '@/lib/report-automation-core'

export function saoPauloPeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  return `${year}-${month}`
}

export function previousPeriod(period: string) {
  const [year, month] = period.slice(0, 7).split('-').map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

async function seedDraftTopics(supabase: SupabaseClient, draftId: string, clientId: string) {
  const { count } = await supabase
    .from('monthly_report_topics')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draftId)
  if (count) return
  const { data: templates, error } = await supabase
    .from('client_report_topic_templates')
    .select('position, title, rationale, inclusion_terms, exclusion_terms, required')
    .eq('client_id', clientId)
    .eq('active', true)
    .order('position')
  if (error) throw new Error(error.message)
  if (templates?.length) {
    const { error: insertError } = await supabase
      .from('monthly_report_topics')
      .insert(templates.map((topic) => ({ draft_id: draftId, ...topic })))
    if (insertError) throw new Error(insertError.message)
  }
}

async function memorySnapshot(supabase: SupabaseClient, clientId: string) {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('client_editorial_profiles').select('*').eq('client_id', clientId).maybeSingle(),
    supabase
      .from('client_editorial_memory_items')
      .select('id, kind, source, topic, reason, snapshot, updated_at')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(40),
  ])
  const include = (rows || []).filter((row) => row.kind === 'evidencia').slice(0, 6)
  const exclude = (rows || []).filter((row) => row.kind === 'contexto' || row.kind === 'ruido').slice(0, 6)
  return { profile: profile || null, inclusion_examples: include, exclusion_examples: exclude, captured_at: new Date().toISOString() }
}

export async function ensureMonthlyDraft(
  supabase: SupabaseClient,
  client: Client,
  period: string
): Promise<MonthlyReportDraft> {
  const periodDate = monthBounds(period).date
  const { data: existing, error: existingError } = await supabase
    .from('monthly_report_drafts')
    .select('*')
    .eq('client_id', client.id)
    .eq('period_month', periodDate)
    .neq('status', 'approved')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing) {
    await seedDraftTopics(supabase, existing.id, client.id)
    return existing as MonthlyReportDraft
  }

  const { data: latest } = await supabase
    .from('monthly_report_drafts')
    .select('version')
    .eq('client_id', client.id)
    .eq('period_month', periodDate)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const snapshot = await memorySnapshot(supabase, client.id)
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .insert({
      client_id: client.id,
      period_month: periodDate,
      version: Number(latest?.version || 0) + 1,
      status: 'preparing',
      brand_snapshot: reportBrand(client),
      narrative_posture: (snapshot.profile as { default_posture?: string } | null)?.default_posture || 'consultivo_cauteloso',
      editorial_memory_snapshot: snapshot,
      automation_status: 'pending',
    })
    .select()
    .single()
  if (error || !draft) throw new Error(error?.message || 'Falha ao criar preparação mensal.')
  const { error: sectionsError } = await supabase.from('report_sections').insert(
    Array.from({ length: 9 }, (_, index) => ({ draft_id: draft.id, section_key: index + 1 }))
  )
  if (sectionsError) throw new Error(sectionsError.message)
  await seedDraftTopics(supabase, draft.id, client.id)
  return draft as MonthlyReportDraft
}

export async function syncDraftClusters(supabase: SupabaseClient, draftId: string) {
  const items = await reportEvidenceItems(supabase, draftId, false)
  const proposed = buildReportClusters(draftId, items)
  const { data: existing } = await supabase.from('report_clusters').select('*').eq('draft_id', draftId)
  const existingByKey = new Map((existing || []).map((cluster) => [cluster.cluster_key, cluster]))
  const claimedExisting = new Set<string>()
  const payload = proposed.map((cluster) => {
    let old = existingByKey.get(cluster.cluster_key)
    if (!old) {
      const articleIds = new Set(cluster.article_ids)
      old = (existing || [])
        .filter((candidate) => !claimedExisting.has(candidate.id))
        .map((candidate) => ({
          candidate,
          overlap: (candidate.article_ids || []).filter((articleId: string) => articleIds.has(articleId)).length,
        }))
        .filter(({ overlap }) => overlap > 0)
        .sort((a, b) => b.overlap - a.overlap)[0]?.candidate
    }
    if (old) claimedExisting.add(old.id)
    return {
      ...cluster,
      cluster_key: old?.cluster_key || cluster.cluster_key,
      label: old?.human_label || cluster.label,
      human_role: old?.human_role || null,
      human_label: old?.human_label || null,
      human_decided_at: old?.human_decided_at || null,
      updated_at: new Date().toISOString(),
    }
  })
  if (payload.length) {
    const { error } = await supabase.from('report_clusters').upsert(payload, { onConflict: 'draft_id,cluster_key' })
    if (error) throw new Error(error.message)
  }
  const currentKeys = new Set(payload.map((cluster) => cluster.cluster_key))
  const removedIds = (existing || []).filter((cluster) => !currentKeys.has(cluster.cluster_key) && !cluster.human_decided_at).map((cluster) => cluster.id)
  if (removedIds.length) await supabase.from('report_clusters').delete().in('id', removedIds)
  return payload as ReportCluster[]
}

export async function syncLeadSuggestions(supabase: SupabaseClient, draft: MonthlyReportDraft) {
  const [items, { data: clusters }] = await Promise.all([
    reportEvidenceItems(supabase, draft.id),
    supabase.from('report_clusters').select('*').eq('draft_id', draft.id),
  ])
  const suggestions = leadSuggestions(draft.id, draft.base_version, items, (clusters || []) as ReportCluster[])
  await supabase.from('report_lead_suggestions').delete().eq('draft_id', draft.id).eq('base_version', draft.base_version)
  if (suggestions.length) {
    const { error } = await supabase.from('report_lead_suggestions').insert(suggestions)
    if (error) throw new Error(error.message)
  }
  return suggestions
}

export async function syncPeriodComparison(supabase: SupabaseClient, draft: MonthlyReportDraft) {
  const priorPeriod = previousPeriod(draft.period_month.slice(0, 7))
  const [{ data: priorDraft }, currentItems] = await Promise.all([
    supabase
      .from('monthly_report_drafts')
      .select('*')
      .eq('client_id', draft.client_id)
      .eq('period_month', monthBounds(priorPeriod).date)
      .order('approved_at', { ascending: false, nullsFirst: false })
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle(),
    reportEvidenceItems(supabase, draft.id),
  ])
  const previousItems = priorDraft ? await reportEvidenceItems(supabase, priorDraft.id) : []
  const comparison = comparePeriods(
    draft.period_month.slice(0, 7),
    currentItems,
    priorDraft ? priorPeriod : null,
    previousItems
  )
  const comparable = (value: PeriodComparison | Record<string, unknown> | undefined) => {
    if (!value) return '{}'
    const rest = { ...value }
    delete rest.generated_at
    return JSON.stringify(rest)
  }
  if (comparable(draft.comparison_snapshot) === comparable(comparison)) {
    return (draft.comparison_snapshot || comparison) as PeriodComparison
  }
  const { error } = await supabase
    .from('monthly_report_drafts')
    .update({ comparison_snapshot: comparison, updated_at: new Date().toISOString() })
    .eq('id', draft.id)
  if (error) throw new Error(error.message)
  return comparison
}

export async function draftExceptions(supabase: SupabaseClient, draftId: string) {
  const [items, { data: topicLinks }] = await Promise.all([
    reportEvidenceItems(supabase, draftId, false),
    supabase
      .from('report_topic_evidence')
      .select('article_id, monthly_report_topics!inner(draft_id, required)')
      .eq('monthly_report_topics.draft_id', draftId)
      .eq('monthly_report_topics.required', true),
  ])
  const agendaIds = new Set((topicLinks || []).map((link) => link.article_id))
  return items
    .map((item) => ({ item, priority: exceptionPriority(item, agendaIds) }))
    .filter((row) => row.priority && row.item.classification_snapshot.editorial_review_state !== 'revisado')
    .sort((a, b) => Number(a.priority) - Number(b.priority) || a.item.position - b.item.position)
}

export async function buildDraftChecklist(supabase: SupabaseClient, draft: MonthlyReportDraft): Promise<ApprovalChecklist> {
  const [items, { data: sections }, { data: topics }, exceptions, { data: quality }] = await Promise.all([
    reportEvidenceItems(supabase, draft.id),
    supabase.from('report_sections').select('*').eq('draft_id', draft.id).order('section_key'),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', draft.id),
    draftExceptions(supabase, draft.id),
    supabase.from('report_quality_checks').select('checks').eq('draft_id', draft.id).eq('base_version', draft.base_version).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  const invalidCitations = ((quality?.checks || []) as Array<{ key?: string; status?: string; count?: number }>)
    .filter((check) => check.status === 'blocked' && ['citation_validity', 'uncited_facts'].includes(String(check.key)))
    .reduce((sum, check) => sum + Number(check.count || 1), 0)
  const packageGeneratedAt = draft.claude_package_generated_at
    ? new Date(draft.claude_package_generated_at).getTime()
    : 0
  const latestMaterialUpdate = Math.max(
    new Date(draft.updated_at).getTime(),
    ...(sections || []).map((section) => new Date(section.updated_at).getTime()),
    ...(topics || []).map((topic) => new Date(topic.updated_at).getTime())
  )
  return approvalChecklist({
    draft,
    items,
    sections: (sections || []) as ReportSection[],
    unresolvedExceptions: exceptions.length,
    uncoveredRequiredTopics: (topics || []).filter((topic) => topic.required && topic.coverage_status !== 'covered' && !(topic.coverage_status === 'gap' && topic.gap_acknowledged_at)).length,
    invalidCitations,
    comparisonReady: Boolean(draft.comparison_snapshot && Object.keys(draft.comparison_snapshot).length),
    packageCurrent:
      draft.claude_package_base_version === draft.base_version &&
      packageGeneratedAt >= latestMaterialUpdate,
  })
}

export async function syncSourceOperationalAlerts(supabase: SupabaseClient) {
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, name, priority, last_success_at, last_fetch_error, active')
    .eq('active', true)
  if (error) throw new Error(error.message)
  const { data: existingAlerts } = await supabase
    .from('operational_alerts')
    .select('id, fingerprint, status, acknowledged_at')
    .in('kind', ['source_failed', 'source_stale'])
    .neq('status', 'resolved')
  const existingByFingerprint = new Map((existingAlerts || []).map((alert) => [alert.fingerprint, alert]))
  const now = Date.now()
  const openFingerprints = new Set<string>()
  for (const source of sources || []) {
    const thresholdHours = Number(source.priority || 0) >= 80 ? 8 : 24
    const ageHours = source.last_success_at ? (now - new Date(source.last_success_at).getTime()) / 3_600_000 : Infinity
    const stale = ageHours >= thresholdHours
    const failed = Boolean(source.last_fetch_error)
    if (!stale && !failed) continue
    const kind = failed ? 'source_failed' : 'source_stale'
    const fingerprint = `${kind}:${source.id}`
    const prior = existingByFingerprint.get(fingerprint)
    openFingerprints.add(fingerprint)
    await supabase.from('operational_alerts').upsert({
      fingerprint,
      kind,
      severity: Number(source.priority || 0) >= 80 ? 'critical' : 'warning',
      status: prior?.status === 'acknowledged' ? 'acknowledged' : 'open',
      source_id: source.id,
      title: failed ? `Falha na fonte ${source.name}` : `Fonte atrasada: ${source.name}`,
      details: { priority: source.priority, threshold_hours: thresholdHours, age_hours: Number.isFinite(ageHours) ? Math.round(ageHours * 10) / 10 : null, error: source.last_fetch_error },
      last_seen_at: new Date().toISOString(),
      resolved_at: null,
      acknowledged_at: prior?.acknowledged_at || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'fingerprint' })
  }
  const resolved = (existingAlerts || []).filter((alert) => !openFingerprints.has(alert.fingerprint)).map((alert) => alert.id)
  if (resolved.length) {
    await supabase.from('operational_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).in('id', resolved)
  }
  return { open: openFingerprints.size, resolved: resolved.length }
}

export async function refreshAutomationArtifacts(supabase: SupabaseClient, draft: MonthlyReportDraft) {
  const refreshed = await refreshDraftEvidence(supabase, draft)
  const current = refreshed.draft as MonthlyReportDraft
  const clusters = await syncDraftClusters(supabase, draft.id)
  const suggestions = await syncLeadSuggestions(supabase, current)
  const comparison = await syncPeriodComparison(supabase, current)
  return { refreshed, clusters, suggestions, comparison }
}

export type AutomationArtifactResult = {
  refreshed: Awaited<ReturnType<typeof refreshDraftEvidence>>
  clusters: ReportCluster[]
  suggestions: LeadSuggestion[]
  comparison: PeriodComparison
}
