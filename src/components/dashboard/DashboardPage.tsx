'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Download, FileText, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ClientAutomationCard from '@/components/dashboard/ClientAutomationCard'
import ExceptionQueueDrawer from '@/components/dashboard/ExceptionQueueDrawer'
import type { DashboardSummary } from '@/types'

const PERIODS = [7, 15, 30] as const

/** Teto de iterações do laço de tick, espelhando o do "Buscar Notícias". */
const MAX_TICKS = 120

function HealthBanner({ summary }: { summary: DashboardSummary }) {
  const { health } = summary
  const degraded =
    !health.coverage_complete ||
    health.stale_sources > 0 ||
    health.failed_sources > 0 ||
    (health.empty_sources || 0) > 0
  const label = health.last_success_at
    ? new Date(health.last_success_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : 'nenhuma coleta concluída'
  const coverageStart = health.coverage_start
    ? new Date(health.coverage_start).toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
      })
    : 'sem matérias datadas'
  return (
    <div className={`mb-6 border px-4 py-3 text-sm ${degraded ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="flex items-center gap-2 font-medium">
        {degraded ? <AlertTriangle className="h-4 w-4 text-amber-700" /> : <span className="h-2 w-2 rounded-full bg-emerald-600" />}
        Cobertura: {degraded ? 'atenção necessária' : 'fontes atualizadas'}
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Última coleta: {label}. {health.healthy_sources}/{health.active_sources} fontes saudáveis
        {health.stale_sources ? `, ${health.stale_sources} atrasadas` : ''}
        {health.failed_sources ? `, ${health.failed_sources} com falha` : ''}
        {health.empty_sources ? `, ${health.empty_sources} sem itens` : ''}
        {health.never_fetched_sources ? `, ${health.never_fetched_sources} ainda não executadas` : ''}.
        {' '}Cobertura do período desde {coverageStart}
        {health.latest_run ? `; última execução ${health.latest_run.status}` : ''}.
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [periodDays, setPeriodDays] = useState<number>(30)
  const [running, setRunning] = useState('')
  const [progress, setProgress] = useState<string>('')
  const [actionError, setActionError] = useState('')
  const [drawer, setDrawer] = useState<{ draftId: string; clientId: string; clientName: string } | null>(null)
  const cancelled = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboard?days=${periodDays}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar o Painel.')
      setSummary(data as DashboardSummary)
      setLoadError(null)
    } catch (error) {
      setSummary(null)
      setLoadError(error instanceof Error ? error.message : 'Falha ao carregar o Painel.')
    } finally {
      setLoading(false)
    }
  }, [periodDays])

  useEffect(() => {
    load()
  }, [load])

  const rows = summary?.clients || []

  async function acknowledgeAlert(id: string) {
    await fetch(`/api/operational-alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged' }),
    })
    setSummary((current) => current ? {
      ...current,
      operational_alerts: (current.operational_alerts || []).map((alert) =>
        alert.id === id ? { ...alert, status: 'acknowledged' } : alert
      ),
    } : current)
  }

  /**
   * Drena a fila da automação até `{ idle: true }`.
   *
   * Mesmo formato do processRun() do "Buscar Notícias": iterações limitadas e
   * parada no primeiro estado terminal. O claim é escopado por cliente para o
   * botão de um card não drenar a fila de outro.
   */
  const drain = useCallback(async (clientId?: string, runId?: string | null) => {
    for (let tick = 0; tick < MAX_TICKS; tick++) {
      if (cancelled.current) return
      const res = await fetch('/api/report-automation/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Só o primeiro tick despausa: nos seguintes, um parque novo precisa
        // ser respeitado, senão o laço gira contra a mesma pendência.
        body: JSON.stringify({ client_id: clientId || null, run_id: runId || null, resume: tick === 0 }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao avançar a automação.')
      if (data?.idle) return
      // Parou por decisão humana ou falta de configuração: nada a ganhar
      // insistindo, o card já vai mostrar o que falta.
      if (data?.status === 'waiting_review' || data?.status === 'waiting_configuration') return
      if (data?.status === 'error') throw new Error(data?.error || 'A automação parou com erro.')
      setProgress(`${data?.stage || 'processando'} → ${data?.next_stage || '…'}`)
    }
  }, [])

  const runAutomation = useCallback(
    async (clientId?: string, label = 'todos os clientes') => {
      cancelled.current = false
      setRunning(clientId || 'all')
      setActionError('')
      setProgress(`iniciando ${label}`)
      try {
        const res = await fetch('/api/report-automation/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_ids: clientId ? [clientId] : undefined }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar a preparação.')
        if (!data?.run_id) {
          setProgress('')
          setActionError(
            data?.skipped
              ? 'Preparação concluída há menos de 10 minutos. Aguarde antes de repetir.'
              : 'Nenhum cliente elegível para preparar agora.'
          )
          return
        }
        await drain(clientId, data.run_id)
      } catch (runError) {
        setActionError(runError instanceof Error ? runError.message : 'Falha na preparação.')
      } finally {
        setRunning('')
        setProgress('')
        await load()
      }
    },
    [drain, load]
  )

  const continueAutomation = useCallback(
    async (clientId?: string) => {
      cancelled.current = false
      setRunning(clientId || 'all')
      setActionError('')
      try {
        await drain(clientId)
      } catch (continueError) {
        setActionError(continueError instanceof Error ? continueError.message : 'Falha ao continuar.')
      } finally {
        setRunning('')
        setProgress('')
        await load()
      }
    },
    [drain, load]
  )

  /** Coleta as notícias sem sair do Painel, reaproveitando o cooldown de 10 min. */
  const collect = useCallback(async () => {
    cancelled.current = false
    setRunning('collect')
    setActionError('')
    setProgress('iniciando coleta')
    try {
      const res = await fetch('/api/fetch-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_type: 'manual' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao iniciar a coleta.')
      if (data?.cooldown) {
        setActionError('Coleta executada há menos de 10 minutos. Aguarde para repetir.')
        return
      }
      const runId = data?.run?.id
      if (!runId) throw new Error('Coleta sem execução associada.')
      for (let tick = 0; tick < MAX_TICKS; tick++) {
        if (cancelled.current) return
        const step = await fetch(`/api/fetch-runs/${runId}/process`, { method: 'POST' })
        const stepData = await step.json().catch(() => null)
        if (!step.ok) throw new Error(stepData?.error || 'Falha ao processar a coleta.')
        const status = stepData?.run?.status
        setProgress(`coletando (${stepData?.run?.inserted_count ?? 0} novas)`)
        if (['concluido', 'parcial', 'erro'].includes(status)) break
      }
    } catch (collectError) {
      setActionError(collectError instanceof Error ? collectError.message : 'Falha na coleta.')
    } finally {
      setRunning('')
      setProgress('')
      await load()
    }
  }, [load])

  useEffect(() => () => { cancelled.current = true }, [])

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-light tracking-tight">Painel</h1>
          <p className="mt-1 text-xs text-gray-400">Cobertura monitorada por cliente, sem truncamento</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading || Boolean(running)}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" onClick={collect} disabled={Boolean(running)}>
            <Download className={`mr-2 h-4 w-4 ${running === 'collect' ? 'animate-pulse' : ''}`} />
            Coletar notícias
          </Button>
          <Button onClick={() => runAutomation()} disabled={Boolean(running) || rows.length === 0}>
            <Play className="mr-2 h-4 w-4" />
            Preparar mês (todos)
          </Button>
          <Link href="/reports/prepare">
            <Button variant="outline" disabled={loading || rows.length === 0}>
              <FileText className="mr-2 h-4 w-4" />
              Preparação mensal
            </Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs uppercase tracking-widest text-gray-500">Período:</span>
        {PERIODS.map((days) => (
          <button
            key={days}
            onClick={() => setPeriodDays(days)}
            className={`border px-3 py-1 text-xs uppercase tracking-widest transition-colors ${
              periodDays === days ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600 hover:border-black'
            }`}
          >
            {days} dias
          </button>
        ))}
      </div>

      {Boolean(running) && (
        <div className="mb-4 flex items-center gap-2 border border-gray-300 bg-gray-50 px-4 py-2 text-sm">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>{progress || 'processando…'}</span>
          <button
            className="ml-auto text-xs underline"
            onClick={() => {
              cancelled.current = true
            }}
          >
            Interromper
          </button>
        </div>
      )}
      {actionError && (
        <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">{actionError}</div>
      )}

      {summary && <HealthBanner summary={summary} />}
      {summary?.operational_alerts && summary.operational_alerts.length > 0 && (
        <div className="mb-6 border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" /> Alertas operacionais ({summary.operational_alerts.length})
          </p>
          <div className="mt-2 grid gap-1 text-xs text-amber-800 md:grid-cols-2">
            {summary.operational_alerts.slice(0, 8).map((alert) => (
              <p key={alert.id} className="flex items-center justify-between gap-2">
                <span>{alert.severity === 'critical' ? '●' : '○'} {alert.title}</span>
                {alert.status === 'open' && <button className="underline" onClick={() => acknowledgeAlert(alert.id)}>Reconhecer</button>}
              </p>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400">Carregando contagens exatas…</p>
      ) : loadError ? (
        <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Não foi possível montar o Painel.</p>
          <p className="mt-1">{loadError}</p>
        </div>
      ) : rows.length === 0 ? (
        <p className="py-24 text-center text-gray-400">Nenhum cliente ativo encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <ClientAutomationCard
              key={row.client.id}
              row={row}
              busy={Boolean(running)}
              onPrepare={() => runAutomation(row.client.id, row.client.name)}
              onContinue={() => continueAutomation(row.client.id)}
              onOpenExceptions={() =>
                row.readiness?.draft_id &&
                setDrawer({
                  draftId: row.readiness.draft_id,
                  clientId: row.client.id,
                  clientName: row.client.name,
                })
              }
              onChanged={() => continueAutomation(row.client.id)}
            />
          ))}
        </div>
      )}

      {drawer && (
        <ExceptionQueueDrawer
          draftId={drawer.draftId}
          clientId={drawer.clientId}
          clientName={drawer.clientName}
          onClose={() => {
            setDrawer(null)
            load()
          }}
          onDrained={() => {
            const clientId = drawer.clientId
            setDrawer(null)
            continueAutomation(clientId)
          }}
        />
      )}
    </div>
  )
}
