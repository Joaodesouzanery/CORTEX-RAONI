'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Download, RefreshCw, Sparkles, Star, Save, CheckCircle2 } from 'lucide-react'
import type {
  Client,
  EditorialReviewState,
  MonthlyReportDraft,
  ReportEvidenceItem,
  ReportSection,
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
  const [evidenceFilter, setEvidenceFilter] = useState<'all' | 'pending' | 'qualified' | 'annex'>('all')
  const [editingArticleId, setEditingArticleId] = useState('')
  const [qualification, setQualification] = useState({
    central_message: '',
    impact_summary: '',
    strategic_effect: 'informativo' as StrategicEffect,
    recommended_action: '',
    verification_status: 'pendente' as VerificationStatus,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const queryClient = params.get('client')
    const queryPeriod = params.get('period')
    if (queryPeriod && /^\d{4}-\d{2}$/.test(queryPeriod)) setPeriod(queryPeriod)
    fetch('/api/clients?active=true')
      .then((response) => response.json())
      .then((data) => {
        const rows = Array.isArray(data) ? data : []
        setClients(rows)
        setClientId(queryClient && rows.some((client: Client) => client.id === queryClient) ? queryClient : rows[0]?.id || '')
      })
  }, [])

  function applyDraft(data: MonthlyReportDraft) {
    setDraft(data)
    setInstructions(data.monthly_instructions || '')
    setMetrics((current) => ({ ...current, ...(data.service_metrics || {}) }))
    setSectionTexts(
      Object.fromEntries((data.sections || []).map((section) => [section.section_key, section.content || '']))
    )
  }

  async function loadDraft(id: string) {
    const res = await fetch(`/api/report-drafts/${id}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || 'Falha ao carregar a preparação.')
    applyDraft(data)
    return data as MonthlyReportDraft
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

  async function persistInputs() {
    if (!draft) return
    const res = await fetch(`/api/report-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ monthly_instructions: instructions, service_metrics: metrics }),
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

  async function finalize(confirmPending = false) {
    if (!draft) return
    setBusy('finalize')
    setError('')
    try {
      const res = await fetch(`/api/report-drafts/${draft.id}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm_pending: confirmPending }),
      })
      const data = await res.json().catch(() => null)
      if (res.status === 409 && data?.code === 'PENDING_REVIEW') {
        const confirmed = window.confirm(
          `${data.pending_review} ocorrência(s) ainda estão pendentes. Elas serão preservadas no anexo. Deseja finalizar mesmo assim?`
        )
        if (confirmed) {
          setBusy('')
          await finalize(true)
        }
        return
      }
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
  const orderedEvidence = [...evidence].sort((a, b) => {
    if (a.article_id === draft?.lead_article_id) return -1
    if (b.article_id === draft?.lead_article_id) return 1
    return a.bucket.localeCompare(b.bucket) || a.position - b.position
  })
  const visibleEvidence = orderedEvidence.filter((item) => {
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
        <div className="mt-4">
          <Label>Instruções específicas do mês</Label>
          <Textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Ex.: priorizar a operação bem-sucedida na Copa e preparar a Copa Feminina de 2027."
            rows={3}
            className="mt-1"
          />
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
          <div className="grid md:grid-cols-5 border border-gray-200 mb-4 divide-x">
            <div className="p-4"><p className="text-xs text-gray-500">Base integral</p><p className="text-3xl">{evidence.length}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Base qualificada</p><p className="text-3xl">{counts.qualified}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Anexo monitorado</p><p className="text-3xl">{counts.annex}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Excluídas manualmente</p><p className="text-3xl">{counts.excluded}</p></div>
            <div className="p-4"><p className="text-xs text-gray-500">Pendentes de revisão</p><p className="text-3xl">{counts.pending}</p></div>
          </div>
          <div className="flex gap-2 flex-wrap mb-6">
            <Button variant="outline" onClick={refreshBase} disabled={!!busy}>
              <RefreshCw className="w-4 h-4 mr-2" />Atualizar base
            </Button>
            <Button variant="outline" onClick={triageAll} disabled={!!busy}>
              <Sparkles className="w-4 h-4 mr-2" />
              {triageProgress ? `${triageProgress.done} triadas; ${triageProgress.remaining} restantes` : 'Triar todo o universo'}
            </Button>
            <a href={`/api/report-drafts/${draft.id}/export?format=dossier`}><Button variant="outline"><Download className="w-4 h-4 mr-2" />Dossiê</Button></a>
            <a href={`/api/report-drafts/${draft.id}/export?format=csv`}><Button variant="outline"><Download className="w-4 h-4 mr-2" />CSV integral</Button></a>
            <a href={`/api/report-drafts/${draft.id}/export?format=annex`}><Button variant="outline">Anexo</Button></a>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold">Base e matéria principal</h2>
              {!draft.lead_article_id && <span className="text-sm text-amber-700">Escolha obrigatória antes da geração</span>}
            </div>
            <div className="flex gap-2 mb-2 flex-wrap">
              {([
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
                          {article.publisher || article.source_name || 'Veículo não identificado'} · {item.bucket} · nota {String(item.classification_snapshot.editorial_score ?? '—')}
                        </p>
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
                            <Label>Verificação</Label>
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
            <Button onClick={generateMissing} disabled={!!busy || !draft.lead_article_id}>
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
                    <Button size="sm" onClick={() => generateSection(section)} disabled={!!busy || !draft.lead_article_id}>
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
              <p className="text-sm text-gray-500">A seção 10 usa apenas a base qualificada. O anexo permanece separado.</p>
            </div>
            <div className="flex gap-2">
              <a href={`/api/report-drafts/${draft.id}/export?format=text`}>
                <Button variant="outline"><Download className="w-4 h-4 mr-2" />Handoff Claude Design</Button>
              </a>
              <Button onClick={() => finalize()} disabled={!!busy || draft.status === 'approved'}>
                <CheckCircle2 className="w-4 h-4 mr-2" />{draft.status === 'approved' ? 'Versão aprovada' : 'Finalizar versão'}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
