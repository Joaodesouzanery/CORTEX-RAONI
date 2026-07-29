'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { runSectionedReport } from '@/lib/report-runner'
import type { Article, DashboardSummary, PaginatedArticles } from '@/types'

const PERIODS = [7, 15, 30] as const

interface BatchResult {
  client: string
  ok: boolean
  reportId?: string
  error?: string
}

async function loadMonitoredArticles(clientId: string, days: number): Promise<Article[]> {
  const all: Article[] = []
  let cursor: string | null = null
  do {
    const query = new URLSearchParams({
      paginated: 'true',
      client_id: clientId,
      days: String(days),
      limit: '200',
    })
    if (cursor) query.set('cursor', cursor)
    const res = await fetch(`/api/articles?${query}`)
    const data = (await res.json().catch(() => null)) as PaginatedArticles | { error?: string } | null
    if (!res.ok || !data || !('items' in data)) {
      throw new Error((data && 'error' in data && data.error) || 'Falha ao carregar matérias monitoradas.')
    }
    all.push(...data.items)
    cursor = data.next_cursor
  } while (cursor)
  return all
}

function HealthBanner({ summary }: { summary: DashboardSummary }) {
  const { health } = summary
  const degraded = !health.coverage_complete || health.stale_sources > 0 || health.failed_sources > 0
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
        {health.failed_sources ? `, ${health.failed_sources} vazias/com falha` : ''}
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
  const [batchOpen, setBatchOpen] = useState(false)
  const [mes, setMes] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ i: number; total: number; client: string; label: string } | null>(null)
  const [results, setResults] = useState<BatchResult[]>([])

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

  function openBatch() {
    setSelectedIds(new Set(rows.filter((row) => row.total > 0).map((row) => row.client.id)))
    setResults([])
    setBatchOpen(true)
  }

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBatch() {
    if (!mes.trim()) return
    const targets = rows.filter((row) => selectedIds.has(row.client.id))
    setRunning(true)
    setResults([])
    const output: BatchResult[] = []
    for (let index = 0; index < targets.length; index++) {
      const { client } = targets[index]
      try {
        setBatchProgress({ i: index + 1, total: targets.length, client: client.name, label: 'carregando matérias' })
        const relevant = await loadMonitoredArticles(client.id, periodDays)
        if (!relevant.length) throw new Error('Sem notícias monitoradas no período')
        const basePayload = {
          prompt: '',
          article_ids: relevant.map((article) => article.id),
          client_id: client.id,
          metadata: {
            mes: mes.trim(),
            reunioes_presenciais: 0,
            reunioes_virtuais: 0,
            orientacoes: 0,
            acoes_imprensa: 0,
          },
        }
        const content = await runSectionedReport({
          basePayload,
          articles: relevant,
          contratante: client.contratante,
          onProgress: (_done, _total, label) =>
            setBatchProgress({ i: index + 1, total: targets.length, client: client.name, label }),
        })
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, content }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha ao salvar')
        output.push({ client: client.name, ok: true, reportId: data.id })
      } catch (error) {
        output.push({
          client: client.name,
          ok: false,
          error: error instanceof Error ? error.message : 'Erro',
        })
      }
      setResults([...output])
    }
    setBatchProgress(null)
    setRunning(false)
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-5xl font-light tracking-tight">Painel</h1>
          <p className="mt-1 text-xs text-gray-400">Cobertura monitorada por cliente, sem truncamento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button onClick={openBatch} disabled={loading || rows.length === 0}>
            <FileText className="mr-2 h-4 w-4" />
            Gerar relatórios do mês
          </Button>
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

      {summary && <HealthBanner summary={summary} />}

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
          {rows.map(({ client, total, direct_mentions, review_count, variation_percent }) => (
            <div key={client.id} className="flex flex-col gap-3 border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                {client.logo_url && (
                  <Image src={client.logo_url} alt={client.name} width={64} height={32} unoptimized className="h-8 w-16 object-contain" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{client.name}</p>
                  {client.sector && <p className="truncate text-xs text-gray-500">{client.sector}</p>}
                </div>
              </div>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div>
                    <span className="text-4xl font-light tabular-nums">{total}</span>
                    <span className="ml-1 text-xs text-gray-500">monitoradas</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {direct_mentions} menções diretas · {review_count} em revisão
                    {variation_percent != null && ` · ${variation_percent >= 0 ? '+' : ''}${variation_percent}%`}
                  </p>
                </div>
                <Link href={`/news?client=${client.id}&period=${periodDays}`} className="whitespace-nowrap text-sm hover:underline">
                  Ver notícias ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !running && setBatchOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-6" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-1 text-2xl font-light">Gerar relatórios do mês</h2>
            <p className="mb-4 text-xs text-gray-500">Um relatório por cliente usando todas as matérias monitoradas no período.</p>
            <label className="text-sm font-semibold">Mês de referência *</label>
            <Input value={mes} onChange={(event) => setMes(event.target.value)} placeholder="Ex: Julho de 2026" className="mb-4 mt-1" disabled={running} />
            <p className="mb-2 text-sm font-semibold">Clientes</p>
            <div className="mb-4 max-h-60 overflow-y-auto border border-gray-100">
              {rows.map(({ client, total }) => {
                const result = results.find((item) => item.client === client.name)
                return (
                  <label key={client.id} className="flex items-center gap-3 border-b border-gray-100 px-3 py-2 text-sm last:border-0">
                    <input type="checkbox" checked={selectedIds.has(client.id)} onChange={() => toggle(client.id)} disabled={running || total === 0} />
                    <span className="flex-1 truncate">{client.name}</span>
                    <span className="text-xs text-gray-400">{total}</span>
                    {result && <span className={result.ok ? 'text-green-600' : 'text-red-600'} title={result.error}>{result.ok ? '✓' : '✗'}</span>}
                  </label>
                )
              })}
            </div>
            {batchProgress && (
              <p className="mb-3 text-sm text-gray-600">
                {batchProgress.i}/{batchProgress.total} — <strong>{batchProgress.client}</strong> ({batchProgress.label})…
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBatchOpen(false)} disabled={running}>Fechar</Button>
              <Button onClick={runBatch} disabled={running || !mes.trim() || selectedIds.size === 0}>
                {running ? 'Gerando…' : `Gerar (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
