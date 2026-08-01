'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import type {
  ApprovalChecklist,
  Client,
  EditorialReviewState,
  MonthlyReportTopic,
  LeadSuggestion,
  MonthlyReportDraft,
  PeriodComparison,
  ReportCluster,
  ReportEvidenceItem,
  ReportPosture,
  ReportSection,
  SourceVerificationStatus,
  StrategicEffect,
  VerificationStatus,
} from '@/types'

const SECTION_LABELS = [
  'Sumário Executivo',
  'Temas Estratégicos',
  'Leitura Reputacional',
  'Análise Temática Aprofundada',
  'Riscos Reputacionais',
  'Oportunidades',
  'Recomendações',
  'Cenários Prospectivos',
  'Demonstração dos Serviços',
]

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ReportPreparationPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [period, setPeriod] = useState(currentPeriod())
  const [instructions, setInstructions] = useState('')
  const [narrativePosture, setNarrativePosture] =
    useState<ReportPosture>('consultivo_cauteloso')
  const [metrics, setMetrics] = useState({
    reunioes_presenciais: 0,
    reunioes_virtuais: 0,
    orientacoes: 0,
    acoes_imprensa: 0,
  })
  const [draft, setDraft] = useState<MonthlyReportDraft | null>(null)
  const [sectionTexts, setSectionTexts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [triageProgress, setTriageProgress] = useState<{ done: number; remaining: number } | null>(null)
  const [verificationProgress, setVerificationProgress] = useState<{ done: number; remaining: number } | null>(null)
  const [evidenceFilter, setEvidenceFilter] = useState<'exceptions' | 'all' | 'pending' | 'qualified' | 'annex'>('exceptions')
  const [reviewQueueCount, setReviewQueueCount] = useState(0)
  const [reviewQueueIds, setReviewQueueIds] = useState<Set<string>>(new Set())
  const [clusters, setClusters] = useState<ReportCluster[]>([])
  const [leadSuggestions, setLeadSuggestions] = useState<LeadSuggestion[]>([])
  const [comparison, setComparison] = useState<PeriodComparison | null>(null)
  const [checklist, setChecklist] = useState<ApprovalChecklist | null>(null)
  const [changes, setChanges] = useState<{ added: unknown[]; removed: unknown[]; reclassified: unknown[]; bucket_changes: unknown[] } | null>(null)
  const [editingArticleId, setEditingArticleId] = useState('')
  const [qualification, setQualification] = useState({
    central_message: '',
    impact_summary: '',
    strategic_effect: 'informativo' as StrategicEffect,
    recommended_action: '',
    verification_status: 'pendente' as VerificationStatus,
    source_verification_status: 'nao_verificada' as SourceVerificationStatus,
  })
  const [topicForm, setTopicForm] = useState({
    title: '',
    rationale: '',
    inclusion_terms: '',
    exclusion_terms: '',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryClient = params.get('client')
    const queryPeriod = params.get('period')
    const queryDraft = params.get('draft')
    if (queryPeriod && /^\d{4}-\d{2}$/.test(queryPeriod)) setPeriod(queryPeriod)
    fetch('/api/clients?active=true')
      .then((response) => response.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : []
        setClients(rows)
        setClientId(queryClient && rows.some((client: Client) => client.id === queryClient) ? queryClient : rows[0]?.id || '')
        if (queryDraft) {
          fetch(`/api/report-drafts/${queryDraft}`)
            .then(async (response) => {
              const reportDraft = await response.json().catch(() => null)
              if (!response.ok) throw new Error(reportDraft?.error || 'Falha ao carregar a preparação.')
              setDraft(reportDraft)
              setClientId(reportDraft.client_id)
              setPeriod(String(reportDraft.period_month).slice(0, 7))
              setInstructions(reportDraft.monthly_instructions || '')
              setNarrativePosture(reportDraft.narrative_posture || 'consultivo_cauteloso')
              setMetrics((current) => ({ ...current, ...(reportDraft.service_metrics || {}) }))
              setSectionTexts(
                Object.fromEntries(
                  (reportDraft.sections || []).map((section: ReportSection) => [
                    section.section_key,
                    section.content || '',
                  ])
                )
              )
              void loadAutomationData(reportDraft.id)
            })
            .catch((loadError) => {
              setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar a preparação.')
            })
        }
      })
  }, [])

  function applyDraft(data: MonthlyReportDraft) {
    setDraft(data)
    setClientId(data.client_id)
    setPeriod(String(data.period_month).slice(0, 7))
    setInstructions(data.monthly_instructions || '')
    setNarrativePosture(data.narrative_posture || 'consultivo_cauteloso')
    setMetrics((current) => ({ ...current, ...(data.service_metrics || {}) }))
    setSectionTexts(
      Object.fromEntries((data.sections || []).map((section) => [section.section_key, section.content || '']))
    )
  }

  async function loadAutomationData(id: string) {
    const paths = ['review-queue', 'clusters', 'lead-suggestions', 'comparison', 'checklist', 'changes']
    const results = await Promise.allSettled(
      paths.map(async (path) => {
        const response = await fetch(`/api/report-drafts/${id}/${path}`, { cache: 'no-store' })
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || `Falha ao carregar ${path}.`)
        return data
      })
    )
    const value = (index: number) => results[index].status === 'fulfilled' ? results[index].value : null
    setReviewQueueCount(Number(value(0)?.total || 0))
    setReviewQueueIds(new Set((value(0)?.items || []).map((item: { article_id: string }) => item.article_id)))
    setClusters(Array.isArray(value(1)) ? value(1) : [])
    setLeadSuggestions(Array.isArray(value(2)) ? value(2) : [])
    setComparison(value(3))
    setChecklist(value(4))
    setChanges(value(5)?.summary || null)
  }

  async function loadDraft(id: string) {
    const res = await fetch(`/api/report-drafts/${id}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'Falha ao carregar a preparação.')
    applyDraft(data)
    await loadAutomationData(id)
    return data as MonthlyReportDraft
  }

  async function completeReview() {
    if (!draft) return
    setBusy('checkpoint')
    setError('')
    try {
      const response = await fetch(`/api/report-drafts/${draft.id}/review-checkpoint`, { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Falha ao concluir a revisão.')
      await loadDraft(draft.id)
    } catch (checkpointError) {
      setError(checkpointError instanceof Error ? checkpointError.message : 'Falha ao concluir a revisão.')
    } finally {
      setBusy('')
    }
  }

  async function applyCluster(cluster: ReportCluster, role: 'evidencia' | 'contexto' | 'ruido') {
    if (!draft) return
    setBusy(`cluster-${cluster.cluster_key}`)
    setError('')
    try {
      const response = await fetch(`/api/report-drafts/${draft.id}/clusters/${cluster.cluster_key}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, label: cluster.label, reason: cluster.suggestion_reason }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'Falha ao confirmar a pauta.')
      await loadDraft(draft.id)
    } catch (clusterError) {
      setError(clusterError instanceof Error ? clusterError.message : 'Falha ao confirmar a pauta.')
    } finally {
      setBusy('')
    }
  }

  async function prepare(newVersion = false) {
    if (!clientId || !period) return
    setBusy('prepare')
    setError('')
    try {
      const res = await fetch('/api/report-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          period,
          monthly_instructions: instructions,
          service_metrics: metrics,
          narrative_posture: narrativePosture,
          new_version: newVersion,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao preparar a base mensal.')
      await loadDraft((data.draft || data).id)
    } catch (prepareError) {
      setError(prepareError instanceof Error ? prepareError.message : 'Falha ao preparar.')
    } finally {
      setBusy('')
    }
  }

  async function refreshBase() {
    if (!draft) return
    setBusy('refresh')
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/refresh`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao atualizar a base.')
      await loadDraft(draft.id)
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Falha ao atualizar.')
    } finally {
      setBusy('')
    }
  }

  async function triageAll() {
    if (!draft) return
    if (!draft.topics?.length) {
      setError('Defina ao menos um tópico da agenda mensal antes de iniciar a triagem.')
      return
    }
    setBusy('triage')
    setError('')
    setTriageProgress({ done: 0, remaining: draft.evidence_items?.length || 0 })
    let done = 0
    try {
      for (;;) {
        const res = await fetch(`/api/report-drafts/${draft.id}/triage`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha na triagem.')
        done += data.processed || 0
        setTriageProgress({ done, remaining: data.remaining || 0 })
        if (data.complete) break
      }
      await loadDraft(draft.id)
    } catch (triageError) {
      setError(triageError instanceof Error ? triageError.message : 'Falha na triagem.')
    } finally {
      setBusy('')
      setTriageProgress(null)
    }
  }

  async function verifyAll() {
    if (!draft) return
    setBusy('verify')
    setError('')
    setVerificationProgress({ done: 0, remaining: counts.qualified })
    let done = 0
    try {
      for (;;) {
        const res = await fetch(`/api/report-drafts/${draft.id}/verify`, { method: 'POST' })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha na verificação independente.')
        done += data.processed || 0
        setVerificationProgress({ done, remaining: data.remaining || 0 })
        if (data.complete) break
      }
      await loadDraft(draft.id)
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Falha na verificação independente.'
      )
    } finally {
      setBusy('')
      setVerificationProgress(null)
    }
  }

  async function runQualityChecks() {
    if (!draft) return
    setBusy('quality')
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/quality`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha nos portões de qualidade.')
      await loadDraft(draft.id)
    } catch (qualityError) {
      setError(qualityError instanceof Error ? qualityError.message : 'Falha nos portões de qualidade.')
    } finally {
      setBusy('')
    }
  }

  async function addTopic() {
    if (!draft || !topicForm.title.trim() || !topicForm.inclusion_terms.trim()) return
    setBusy('topic-add')
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: topicForm.title,
          rationale: topicForm.rationale,
          inclusion_terms: topicForm.inclusion_terms.split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean),
          exclusion_terms: topicForm.exclusion_terms.split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean),
          required: true,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao criar o tópico.')
      setTopicForm({ title: '', rationale: '', inclusion_terms: '', exclusion_terms: '' })
      await loadDraft(draft.id)
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : 'Falha ao criar o tópico.')
    } finally {
      setBusy('')
    }
  }

  async function updateTopic(topic: MonthlyReportTopic, patch: Record<string, unknown>) {
    if (!draft) return
    setBusy(`topic-${topic.id}`)
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/topics/${topic.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao atualizar o tópico.')
      await loadDraft(draft.id)
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : 'Falha ao atualizar o tópico.')
    } finally {
      setBusy('')
    }
  }

  async function searchTopic(topic: MonthlyReportTopic) {
    if (!draft) return
    setBusy(`topic-search-${topic.id}`)
    setError('')
    try {
      const search = async (afterFetch: boolean) => {
        const res = await fetch(`/api/report-drafts/${draft.id}/topics/${topic.id}/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ after_fetch: afterFetch }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha na busca do tópico.')
        return data
      }
      const result = await search(false)
      if (result.fetch_run_id) {
        for (let index = 0; index < 40; index++) {
          const process = await fetch(`/api/fetch-runs/${result.fetch_run_id}/process`, { method: 'POST' })
          const processData = await process.json().catch(() => null)
          if (!process.ok) throw new Error(processData?.error || 'Falha ao atualizar as fontes.')
          if (['concluido', 'parcial', 'erro'].includes(processData.run?.status)) break
        }
        await refreshBase()
        await search(true)
      }
      await loadDraft(draft.id)
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : 'Falha na busca do tópico.')
    } finally {
      setBusy('')
    }
  }

  async function editTopic(topic: MonthlyReportTopic) {
    const title = window.prompt('Título do tópico', topic.title)
    if (!title) return
    const rationale = window.prompt('Justificativa editorial', topic.rationale) ?? topic.rationale
    const inclusion = window.prompt('Termos de inclusão, separados por vírgula', topic.inclusion_terms.join(', '))
    if (!inclusion) return
    const exclusion = window.prompt('Termos de exclusão, separados por vírgula', topic.exclusion_terms.join(', '))
    await updateTopic(topic, {
      title,
      rationale,
      inclusion_terms: inclusion.split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean),
      exclusion_terms: (exclusion || '').split(/[,;\n]+/).map((term) => term.trim()).filter(Boolean),
      coverage_status: 'unchecked',
      acknowledge_gap: false,
    })
  }

  async function deleteTopic(topic: MonthlyReportTopic) {
    if (!draft || !window.confirm(`Remover o tópico “${topic.title}”?`)) return
    setBusy(`topic-delete-${topic.id}`)
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/topics/${topic.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao remover o tópico.')
      await loadDraft(draft.id)
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : 'Falha ao remover o tópico.')
    } finally {
      setBusy('')
    }
  }

  async function moveTopic(topic: MonthlyReportTopic, direction: -1 | 1) {
    if (!draft) return
    const ordered = [...topics].sort((a, b) => a.position - b.position)
    const index = ordered.findIndex((candidate) => candidate.id === topic.id)
    const next = index + direction
    if (index < 0 || next < 0 || next >= ordered.length) return
    ;[ordered[index], ordered[next]] = [ordered[next], ordered[index]]
    setBusy(`topic-move-${topic.id}`)
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/topics/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ordered_ids: ordered.map((candidate) => candidate.id) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao reordenar os tópicos.')
      await loadDraft(draft.id)
    } catch (topicError) {
      setError(topicError instanceof Error ? topicError.message : 'Falha ao reordenar os tópicos.')
    } finally {
      setBusy('')
    }
  }

  async function persistInputs() {
    if (!draft) return
    const res = await fetch(`/api/report-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthly_instructions: instructions,
        service_metrics: metrics,
        narrative_posture: narrativePosture,
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'Falha ao salvar os dados do mês.')
  }

  async function saveInputs() {
    if (!draft) return
    setBusy('save-inputs')
    setError('')
    try {
      await persistInputs()
      await loadDraft(draft.id)
    } catch (inputError) {
      setError(inputError instanceof Error ? inputError.message : 'Falha ao salvar os dados.')
    } finally {
      setBusy('')
    }
  }

  async function chooseLead(articleId: string) {
    if (!draft) return
    setBusy(`lead-${articleId}`)
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao definir matéria principal.')
      await loadDraft(draft.id)
    } catch (leadError) {
      setError(leadError instanceof Error ? leadError.message : 'Falha ao escolher matéria principal.')
    } finally {
      setBusy('')
    }
  }

  async function setRole(item: ReportEvidenceItem, role: 'evidencia' | 'contexto' | 'ruido' | 'excluido') {
    if (!draft) return
    setBusy(`role-${item.article_id}`)
    setError('')
    const patch =
      role === 'excluido'
        ? { monitoring_status: 'excluido', report_role: 'ruido', editorial_score: 0 }
        : {
            monitoring_status: 'confirmado',
            report_role: role,
            editorial_score: role === 'evidencia' ? 85 : role === 'contexto' ? 45 : 10,
          }
    try {
      const res = await fetch('/api/articles/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: item.article_id,
          client_id: draft.client_id,
          ...patch,
          editorial_confidence: role === 'evidencia' ? 1 : role === 'contexto' ? 0.7 : 0.95,
          editorial_review_state: 'revisado',
          editorial_reason: 'Decisão manual na preparação mensal.',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar decisão.')
      await fetch(`/api/report-drafts/${draft.id}/refresh`, { method: 'POST' })
      await loadDraft(draft.id)
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : 'Falha ao salvar decisão.')
    } finally {
      setBusy('')
    }
  }

  function startQualification(item: ReportEvidenceItem) {
    const classification = item.classification_snapshot
    setEditingArticleId(item.article_id)
    setQualification({
      central_message: String(classification.central_message || item.article_snapshot.excerpt || item.article_snapshot.title),
      impact_summary: String(classification.impact_summary || ''),
      strategic_effect: (classification.strategic_effect as StrategicEffect) || 'informativo',
      recommended_action: String(classification.recommended_action || ''),
      verification_status: (classification.verification_status as VerificationStatus) || 'pendente',
      source_verification_status:
        (classification.source_verification_status as SourceVerificationStatus) || 'nao_verificada',
    })
  }

  async function saveQualification(item: ReportEvidenceItem) {
    if (!draft) return
    setBusy(`qualification-${item.article_id}`)
    setError('')
    try {
      const res = await fetch('/api/articles/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: item.article_id,
          client_id: draft.client_id,
          ...qualification,
          editorial_review_state: 'revisado' as EditorialReviewState,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar a ficha estratégica.')
      await fetch(`/api/report-drafts/${draft.id}/refresh`, { method: 'POST' })
      await loadDraft(draft.id)
      setEditingArticleId('')
    } catch (qualificationError) {
      setError(qualificationError instanceof Error ? qualificationError.message : 'Falha ao salvar a ficha.')
    } finally {
      setBusy('')
    }
  }

  async function generateSection(section: number) {
    if (!draft) return
    setBusy(`generate-${section}`)
    setError('')
    try {
      await persistInputs()
      const res = await fetch(`/api/report-drafts/${draft.id}/sections/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructions }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || `Falha ao gerar a seção ${section}.`)
      setSectionTexts((current) => ({ ...current, [section]: data.section.content }))
      await loadDraft(draft.id)
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Falha ao gerar seção.')
    } finally {
      setBusy('')
    }
  }

  async function generateMissing() {
    if (!draft) return
    const missing = Array.from({ length: 9 }, (_, index) => index + 1).filter(
      (section) => !sectionTexts[section]?.trim()
    )
    for (const section of missing) await generateSection(section)
  }

  async function saveSection(section: number) {
    if (!draft || !sectionTexts[section]?.trim()) return
    setBusy(`save-${section}`)
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/sections/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sectionTexts[section] }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar a seção.')
      await loadDraft(draft.id)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar.')
    } finally {
      setBusy('')
    }
  }

  async function finalize() {
    if (!draft) return
    setBusy('finalize')
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao finalizar.')
      await loadDraft(draft.id)
      window.open(`/reports/${data.report.id}`, '_blank')
    } catch (finalizeError) {
      setError(finalizeError instanceof Error ? finalizeError.message : 'Falha ao finalizar.')
    } finally {
      setBusy('')
    }
  }

  const evidence = useMemo(() => draft?.evidence_items || [], [draft?.evidence_items])
  const counts = useMemo(
    () => ({
      triaged: evidence.filter(
        (item) =>
          Boolean(item.classification_snapshot.triaged_at) ||
          item.classification_snapshot.report_role_source === 'humano'
      ).length,
      verified: evidence.filter(
        (item) =>
          item.classification_snapshot.editorial_review_state === 'revisado' ||
          (item.classification_snapshot.verification_status === 'verificada' &&
            Boolean(item.classification_snapshot.qa_checked_at))
      ).length,
      qualified: evidence.filter((item) => item.bucket === 'qualified').length,
      annex: evidence.filter((item) => item.bucket === 'annex').length,
      excluded: evidence.filter((item) => item.bucket === 'excluded').length,
      pending: evidence.filter(
        (item) =>
          item.bucket !== 'excluded' && item.classification_snapshot.editorial_review_state === 'pendente'
      ).length,
    }),
    [evidence]
  )
  const topics = draft?.topics || []
  const latestQuality = draft?.quality_checks?.[0]
  const citationCodes = useMemo(
    () =>
      new Map(
        evidence
          .filter((item) => item.bucket === 'qualified')
          .sort((a, b) => a.position - b.position)
          .map((item, index) => [item.article_id, `E${String(index + 1).padStart(3, '0')}`])
      ),
    [evidence]
  )
  const orderedEvidence = [...evidence].sort((a, b) => {
    if (a.article_id === draft?.lead_article_id) return -1
    if (b.article_id === draft?.lead_article_id) return 1
    return a.bucket.localeCompare(b.bucket) || a.position - b.position
  })
  const visibleEvidence = orderedEvidence.filter((item) => {
    if (evidenceFilter === 'exceptions') return reviewQueueIds.has(item.article_id)
    if (evidenceFilter === 'pending') return item.classification_snapshot.editorial_review_state === 'pendente'
    if (evidenceFilter === 'qualified') return item.bucket === 'qualified'
    if (evidenceFilter === 'annex') return item.bucket === 'annex'
    return true
  })

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Preparação mensal</h1>
          <p className="text-sm text-gray-500 mt-1">
            Base integral no servidor, triagem auditável, matéria principal manual e seções editáveis.
          </p>
        </div>
        <Link href="/reports"><Button variant="outline">Relatórios gerados</Button></Link>
      </div>

      <div className="border border-gray-200 p-4 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <Label>Cliente</Label>
            <select
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
              className="mt-1 h-10 w-full border border-gray-300 bg-white px-3 text-sm"
              disabled={!!busy}
            >
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Competência</Label>
            <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => prepare(false)} disabled={!!busy || !clientId}>Preparar / abrir</Button>
            {draft && <Button variant="outline" onClick={() => prepare(true)} disabled={!!busy}>Nova versão</Button>}
            {draft && <Button variant="outline" onClick={saveInputs} disabled={!!busy}>Salvar dados</Button>}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_18rem]">
          <div>
            <Label>Instruções específicas do mês</Label>
            <Textarea
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Ex.: priorizar a operação bem-sucedida na Copa e preparar a Copa Feminina de 2027."
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Postura narrativa</Label>
            <select
              value={narrativePosture}
              onChange={(event) => setNarrativePosture(event.target.value as ReportPosture)}
              className="mt-1 h-10 w-full border border-gray-300 bg-white px-3 text-sm"
            >
              <option value="consultivo_cauteloso">Consultivo cauteloso</option>
              <option value="executivo_assertivo">Executivo assertivo</option>
              <option value="somente_descritivo">Somente descritivo</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">
              O padrão cauteloso evita atribuir decisões ou compromissos ainda não aprovados ao cliente.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {Object.entries(metrics).map(([key, value]) => (
            <div key={key}>
              <Label>{key.replaceAll('_', ' ')}</Label>
              <Input
                type="number"
                min={0}
                value={value}
                onChange={(event) => setMetrics((current) => ({ ...current, [key]: Number(event.target.value) }))}
                className="mt-1"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <div className="border border-red-200 bg-red-50 text-red-700 p-3 text-sm mb-4">{error}</div>}

      {draft && (
        <>
          <div className="grid md:grid-cols-6 border border-gray-200 mb-4 divide-x">
            <div className="p-4"><p className="text-xs text-gray-500">Candidatas detectadas</p><p className="text-3xl">{evidence.length}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Triadas</p><p className="text-3xl">{counts.triaged}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Verificadas editorialmente</p><p className="text-3xl">{counts.verified}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Base qualificada</p><p className="text-3xl">{counts.qualified}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Anexo / ruído</p><p className="text-3xl">{counts.annex}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Em revisão</p><p className="text-3xl">{counts.pending}</p></div>
          </div>
          {draft.methodology_snapshot && (
            <div className="mb-4 border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Universo integral: {draft.methodology_snapshot.monitored_total} · menções diretas:{' '}
              {draft.methodology_snapshot.direct_mentions} · textos integrais:{' '}
              {draft.methodology_snapshot.content_integral} · fontes originais conferidas:{' '}
              {draft.methodology_snapshot.source_original_verified} · documentos integrais preservados:{' '}
              {draft.methodology_snapshot.source_document_integral} · fontes não verificadas:{' '}
              {draft.methodology_snapshot.source_unverified}
            </div>
          )}
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-500">Automação</p>
              <p className="mt-1 font-medium">{draft.automation_status || 'pending'}</p>
              <p className="mt-1 text-xs text-gray-500">Base v{draft.base_version} · {draft.base_digest ? 'snapshot registrado' : 'aguardando snapshot'}</p>
            </div>
            <div className="border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-500">Revisão necessária</p>
              <p className="mt-1 text-2xl">{reviewQueueCount}</p>
              <p className="mt-1 text-xs text-gray-500">A tela abre nesta fila por padrão.</p>
            </div>
            <div className="border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-500">Desde a última revisão</p>
              <p className="mt-1 text-sm">
                +{changes?.added.length || 0} · −{changes?.removed.length || 0} · {changes?.reclassified.length || 0} reclassificadas
              </p>
              <Button className="mt-2" size="sm" variant="outline" onClick={completeReview} disabled={!!busy}>
                Concluir revisão
              </Button>
            </div>
            <div className="border border-gray-200 p-3">
              <p className="text-xs uppercase text-gray-500">Comparação mensal</p>
              <p className="mt-1 text-sm">
                {comparison?.current_total ?? 0} atuais · {comparison?.previous_total ?? 0} anteriores
              </p>
              <p className="mt-1 text-xs text-gray-500">{comparison?.themes_new?.length || 0} tema(s) novo(s)</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap mb-6">
            <Button variant="outline" onClick={refreshBase} disabled={!!busy}>
              <RefreshCw className="w-4 h-4 mr-2" />Atualizar base
            </Button>
            <Button variant="outline" onClick={triageAll} disabled={!!busy}>
              <Sparkles className="w-4 h-4 mr-2" />
              {triageProgress ? `${triageProgress.done} triadas; ${triageProgress.remaining} restantes` : 'Triar todo o universo'}
            </Button>
            <Button variant="outline" onClick={verifyAll} disabled={!!busy || counts.triaged < evidence.length}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              {verificationProgress
                ? `${verificationProgress.done} verificadas; ${verificationProgress.remaining} restantes`
                : 'Verificar evidências'}
            </Button>
            <Button onClick={runQualityChecks} disabled={!!busy}>
              <CheckCircle2 className="w-4 h-4 mr-2" />Executar portões
            </Button>
            <a href={`/api/report-drafts/${draft.id}/export?format=claude-package`}>
              <Button><Download className="w-4 h-4 mr-2" />Gerar pacote para o Claude</Button>
            </a>
          </div>

          {leadSuggestions.length > 0 && (
            <div className="mb-6 border border-gray-200 p-4">
              <h2 className="text-xl font-semibold">Três sugestões de matéria principal</h2>
              <p className="mt-1 text-xs text-gray-500">O sistema pontua e justifica; a escolha continua manual.</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {leadSuggestions.map((suggestion) => {
                  const article = (suggestion.snapshot.article || {}) as { title?: string; publisher?: string }
                  return (
                    <div key={suggestion.article_id} className="border border-gray-100 p-3">
                      <p className="text-xs text-gray-500">#{suggestion.rank} · {suggestion.score.toFixed(0)} pontos</p>
                      <p className="mt-1 font-medium">{article.title || suggestion.article_id}</p>
                      <p className="mt-1 text-xs text-gray-500">{suggestion.rationale}</p>
                      <Button className="mt-3" size="sm" variant={draft.lead_article_id === suggestion.article_id ? 'default' : 'outline'} onClick={() => chooseLead(suggestion.article_id)} disabled={!!busy}>
                        {draft.lead_article_id === suggestion.article_id ? 'Escolhida' : 'Escolher'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {clusters.some((cluster) => cluster.article_count > 1) && (
            <div className="mb-6 border border-gray-200 p-4">
              <h2 className="text-xl font-semibold">Pautas agrupadas</h2>
              <p className="mt-1 text-xs text-gray-500">Veículos continuam separados no acervo. A decisão em lote exige sua confirmação.</p>
              <div className="mt-3 space-y-2">
                {clusters.filter((cluster) => cluster.article_count > 1).slice(0, 20).map((cluster) => (
                  <div key={cluster.cluster_key} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{cluster.human_label || cluster.label}</p>
                      <p className="mt-1 text-xs text-gray-500">{cluster.article_count} publicações · {cluster.vehicle_count} veículos · sugestão: {cluster.suggested_role}</p>
                    </div>
                    <div className="flex gap-1">
                      {(['evidencia', 'contexto', 'ruido'] as const).map((role) => (
                        <Button key={role} size="sm" variant={cluster.human_role === role ? 'default' : 'outline'} onClick={() => applyCluster(cluster, role)} disabled={!!busy}>
                          {role}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 border border-gray-200 p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">Agenda mensal obrigatória</h2>
                <p className="text-xs text-gray-500">
                  A seção 10 será montada deterministicamente com estes tópicos e suas evidências.
                </p>
              </div>
              <span className={`text-xs uppercase ${
                draft.quality_status === 'passed' ? 'text-emerald-700' : draft.quality_status === 'blocked' ? 'text-red-700' : 'text-amber-700'
              }`}>
                Qualidade: {draft.quality_status || 'pending'}
              </span>
            </div>
            <div className="space-y-2">
              {topics.map((topic) => (
                <div key={topic.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 p-3">
                  <div>
                    <p className="font-medium">{topic.position}. {topic.title}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {topic.rationale || 'Sem justificativa'} · {topic.evidence_count || 0} ocorrência(s) · {topic.coverage_status}
                    </p>
                    {topic.gap_reason && <p className="mt-1 text-xs text-amber-700">{topic.gap_reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => moveTopic(topic, -1)} disabled={!!busy || topic.position === 1}>
                      ↑
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => moveTopic(topic, 1)} disabled={!!busy || topic.position === topics.length}>
                      ↓
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => editTopic(topic)} disabled={!!busy}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => searchTopic(topic)} disabled={!!busy}>
                      <Search className="mr-1 h-3 w-3" />Buscar
                    </Button>
                    {topic.coverage_status === 'review' && (
                      <span className="self-center text-xs text-amber-700">
                        Qualifique ao menos uma ocorrência para confirmar a cobertura.
                      </span>
                    )}
                    {topic.coverage_status === 'gap' && !topic.gap_acknowledged_at && (
                      <Button size="sm" variant="outline" onClick={() => updateTopic(topic, { acknowledge_gap: true })} disabled={!!busy}>
                        Reconhecer lacuna
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteTopic(topic)} disabled={!!busy}>
                      Remover
                    </Button>
                  </div>
                </div>
              ))}
              {!topics.length && (
                <div className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Defina ao menos um tópico antes da triagem.
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input
                value={topicForm.title}
                onChange={(event) => setTopicForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Novo tópico obrigatório"
              />
              <Input
                value={topicForm.rationale}
                onChange={(event) => setTopicForm((current) => ({ ...current, rationale: event.target.value }))}
                placeholder="Justificativa editorial"
              />
              <Textarea
                value={topicForm.inclusion_terms}
                onChange={(event) => setTopicForm((current) => ({ ...current, inclusion_terms: event.target.value }))}
                placeholder="Termos de inclusão, separados por vírgula"
                rows={2}
              />
              <Textarea
                value={topicForm.exclusion_terms}
                onChange={(event) => setTopicForm((current) => ({ ...current, exclusion_terms: event.target.value }))}
                placeholder="Termos de exclusão, separados por vírgula"
                rows={2}
              />
            </div>
            <Button className="mt-3" size="sm" onClick={addTopic} disabled={!!busy || !topicForm.title.trim() || !topicForm.inclusion_terms.trim()}>
              <Plus className="mr-1 h-3 w-3" />Adicionar tópico
            </Button>
          </div>

          {latestQuality && (
            <div className={`mb-8 border p-4 ${latestQuality.status === 'passed' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <h2 className="font-semibold">
                Portões de qualidade · {latestQuality.status === 'passed' ? 'aprovados' : 'bloqueados'}
              </h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {latestQuality.checks.map((check) => (
                  <div key={check.key} className="flex items-start gap-2 text-sm">
                    {check.status === 'passed'
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                      : <AlertTriangle className="mt-0.5 h-4 w-4 text-red-700" />}
                    <div>
                      <p>{check.label}{check.count ? ` (${check.count})` : ''}</p>
                      {check.details?.length ? <p className="text-xs text-gray-600">{check.details.slice(0, 3).join(' · ')}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">Base e matéria principal</h2>
              {!draft.lead_article_id && <span className="text-sm text-amber-700">Escolha obrigatória antes da geração</span>}
            </div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {([
                ['exceptions', `Revisão necessária (${reviewQueueCount})`],
                ['all', `Todas (${evidence.length})`],
                ['pending', `Pendentes (${counts.pending})`],
                ['qualified', `Base (${counts.qualified})`],
                ['annex', `Anexo (${counts.annex})`],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={evidenceFilter === value ? 'default' : 'outline'}
                  onClick={() => setEvidenceFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="border border-gray-200 divide-y max-h-[34rem] overflow-y-auto">
              {visibleEvidence.map((item) => {
                const article = item.article_snapshot
                const isLead = item.article_id === draft.lead_article_id
                return (
                  <div key={item.id} className={`p-3 ${isLead ? 'bg-amber-50' : ''}`}>
                    <div className="flex justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{article.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {citationCodes.has(item.article_id) ? `[${citationCodes.get(item.article_id)}] · ` : ''}
                          {article.publisher || article.source_name || 'Veículo não identificado'} · {item.bucket} · nota {String(item.classification_snapshot.editorial_score ?? '—')}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Confiança editorial:{' '}
                          {item.classification_snapshot.editorial_confidence == null
                            ? '—'
                            : `${Math.round(Number(item.classification_snapshot.editorial_confidence) * 100)}%`}
                          {' · '}Escopo: {String(item.classification_snapshot.geographic_scope || 'indeterminado')}
                          {' · '}Verificação editorial: {String(item.classification_snapshot.verification_status || 'pendente')}
                          {' · '}Fonte: {String(item.classification_snapshot.source_verification_status || 'nao_verificada')}
                        </p>
                        {Array.isArray(item.classification_snapshot.quality_flags) &&
                          item.classification_snapshot.quality_flags.length > 0 && (
                            <p className="text-xs text-amber-700 mt-1">
                              Alertas: {(item.classification_snapshot.quality_flags as string[]).join(', ')}
                            </p>
                          )}
                        {Boolean(item.classification_snapshot.editorial_reason) && (
                          <p className="text-xs text-gray-600 mt-1">{String(item.classification_snapshot.editorial_reason)}</p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          <strong>Mensagem:</strong>{' '}
                          {String(item.classification_snapshot.central_message || 'Aguardando qualificação')}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          <strong>Impacto:</strong>{' '}
                          {String(item.classification_snapshot.impact_summary || 'Aguardando qualificação')}
                          {' · '}<strong>Efeito:</strong>{' '}
                          {String(item.classification_snapshot.strategic_effect || 'informativo')}
                          {' · '}<strong>Revisão:</strong>{' '}
                          {String(item.classification_snapshot.editorial_review_state || 'automático')}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <Button size="sm" variant={isLead ? 'default' : 'outline'} onClick={() => chooseLead(item.article_id)} disabled={!!busy || item.bucket === 'excluded'}>
                          <Star className="w-3 h-3 mr-1" />Principal
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setRole(item, 'evidencia')} disabled={!!busy}>Base</Button>
                        <Button size="sm" variant="outline" onClick={() => setRole(item, 'contexto')} disabled={!!busy}>Contexto</Button>
                        <Button size="sm" variant="outline" onClick={() => setRole(item, 'ruido')} disabled={!!busy}>Ruído</Button>
                        <Button size="sm" variant="outline" onClick={() => setRole(item, 'excluido')} disabled={!!busy}>Excluir</Button>
                        <Button size="sm" variant="outline" onClick={() => startQualification(item)} disabled={!!busy}>
                          Qualificar
                        </Button>
                      </div>
                    </div>
                    {editingArticleId === item.article_id && (
                      <div className="border-t mt-3 pt-3 grid md:grid-cols-2 gap-3">
                        <div>
                          <Label>Mensagem central</Label>
                          <Textarea
                            value={qualification.central_message}
                            onChange={(event) =>
                              setQualification((current) => ({ ...current, central_message: event.target.value }))
                            }
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Impacto para o cliente</Label>
                          <Textarea
                            value={qualification.impact_summary}
                            onChange={(event) =>
                              setQualification((current) => ({ ...current, impact_summary: event.target.value }))
                            }
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Ação recomendada</Label>
                          <Textarea
                            value={qualification.recommended_action}
                            onChange={(event) =>
                              setQualification((current) => ({ ...current, recommended_action: event.target.value }))
                            }
                            rows={3}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Efeito estratégico</Label>
                            <select
                              value={qualification.strategic_effect}
                              onChange={(event) =>
                                setQualification((current) => ({
                                  ...current,
                                  strategic_effect: event.target.value as StrategicEffect,
                                }))
                              }
                              className="h-10 w-full border border-gray-300 bg-white px-2 text-sm"
                            >
                              <option value="oportunidade">Oportunidade</option>
                              <option value="risco">Risco</option>
                              <option value="misto">Misto</option>
                              <option value="informativo">Informativo</option>
                            </select>
                          </div>
                          <div>
                            <Label>Verificação editorial</Label>
                            <select
                              value={qualification.verification_status}
                              onChange={(event) =>
                                setQualification((current) => ({
                                  ...current,
                                  verification_status: event.target.value as VerificationStatus,
                                }))
                              }
                              className="h-10 w-full border border-gray-300 bg-white px-2 text-sm"
                            >
                              <option value="verificada">Verificada</option>
                              <option value="parcial">Parcial</option>
                              <option value="pendente">Pendente</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <Label>Conferência da fonte</Label>
                            <select
                              value={qualification.source_verification_status}
                              onChange={(event) =>
                                setQualification((current) => ({
                                  ...current,
                                  source_verification_status: event.target
                                    .value as SourceVerificationStatus,
                                }))
                              }
                              className="h-10 w-full border border-gray-300 bg-white px-2 text-sm"
                            >
                              <option value="nao_verificada">Não verificada</option>
                              <option value="parcial">Fonte parcial</option>
                              <option value="documento_integral">Documento integral preservado</option>
                              <option value="fonte_original">Fonte original conferida</option>
                            </select>
                          </div>
                          <div className="col-span-2 flex gap-2 items-end">
                            <Button size="sm" onClick={() => saveQualification(item)} disabled={!!busy}>
                              Salvar ficha
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditingArticleId('')}>
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold">Seções 1–9</h2>
            <Button onClick={generateMissing} disabled={!!busy || !draft.lead_article_id || draft.quality_status !== 'passed'}>
              <Sparkles className="w-4 h-4 mr-2" />Gerar seções vazias
            </Button>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 9 }, (_, index) => index + 1).map((section) => {
              const row = draft.sections?.find((candidate) => candidate.section_key === section) as ReportSection | undefined
              return (
                <div key={section} className="border border-gray-200 p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-semibold">{section}. {SECTION_LABELS[section - 1]}</p>
                    <span className="text-xs uppercase text-gray-500">{row?.status || 'pending'} · v{row?.version || 1}</span>
                  </div>
                  <Textarea
                    value={sectionTexts[section] || ''}
                    onChange={(event) => setSectionTexts((current) => ({ ...current, [section]: event.target.value }))}
                    rows={sectionTexts[section] ? 12 : 3}
                    placeholder="Gere com IA ou escreva manualmente."
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={() => generateSection(section)} disabled={!!busy || !draft.lead_article_id || draft.quality_status !== 'passed'}>
                      <Sparkles className="w-3 h-3 mr-1" />{sectionTexts[section] ? 'Regenerar' : 'Gerar'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => saveSection(section)} disabled={!!busy || !sectionTexts[section]?.trim()}>
                      <Save className="w-3 h-3 mr-1" />Salvar edição
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="border border-black p-4 mt-6 flex justify-between items-center gap-4">
            <div>
              <p className="font-semibold">Texto final no CORTEX</p>
              <p className="text-sm text-gray-500">A seção 10 registra a agenda; a seção 11 contém somente evidências qualificadas. O anexo permanece separado.</p>
            </div>
            <div className="flex gap-2">
              <a href={`/api/report-drafts/${draft.id}/export?format=claude-package`}>
                <Button variant="outline"><Download className="w-4 h-4 mr-2" />Pacote Claude</Button>
              </a>
              <Button onClick={() => finalize()} disabled={!!busy || draft.status === 'approved' || draft.quality_status !== 'passed'}>
                <CheckCircle2 className="w-4 h-4 mr-2" />{draft.status === 'approved' ? 'Versão aprovada' : 'Finalizar versão'}
              </Button>
            </div>
          </div>
          {checklist && (
            <div className={`mt-4 border p-4 ${checklist.ready ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              <p className="font-semibold">Checklist final · {checklist.ready ? 'pronto para aprovação' : 'há pendências'}</p>
              <div className="mt-2 grid gap-1 md:grid-cols-2">
                {checklist.items.map((item) => (
                  <p key={item.key} className="text-sm">
                    {item.status === 'passed' ? '✓' : item.status === 'warning' ? '!' : '○'} {item.label}{item.detail ? ` — ${item.detail}` : ''}
                  </p>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
