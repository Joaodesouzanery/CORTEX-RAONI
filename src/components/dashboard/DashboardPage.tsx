'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DashboardSummary } from '@/types'

const PERIODS = [7, 15, 30] as const

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
          <Link href="/reports/prepare">
            <Button disabled={loading || rows.length === 0}>
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
          {rows.map(({
            client,
            total,
            triaged_count,
            qualified_count,
            annex_count,
            pending_count,
            direct_mentions,
            variation_percent,
          }) => (
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
                    <span className="ml-1 text-xs text-gray-500">candidatas detectadas</span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {triaged_count} triadas · {qualified_count} evidências · {pending_count} pendentes
                    {variation_percent != null && ` · ${variation_percent >= 0 ? '+' : ''}${variation_percent}%`}
                  </p>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {direct_mentions} menções diretas · {annex_count} em contexto/ruído
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

    </div>
  )
}
