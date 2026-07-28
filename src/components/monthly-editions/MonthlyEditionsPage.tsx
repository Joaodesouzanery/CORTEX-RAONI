'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarRange, Download, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MonthlyEdition } from '@/types'

const STATUS: Record<MonthlyEdition['status'], string> = {
  rascunho: 'Na fila',
  classificando: 'Classificando',
  renderizando: 'Gerando PDF',
  concluido: 'Concluído',
  erro: 'Erro',
}

function previousMonth(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyEditionsPage() {
  const [period, setPeriod] = useState(previousMonth)
  const [editions, setEditions] = useState<MonthlyEdition[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/monthly-editions?period=${period}`)
    const data = await res.json().catch(() => null)
    if (!res.ok) setError(data?.error || 'Falha ao carregar fechamentos.')
    else setEditions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [period])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    if (!editions.some((e) => ['rascunho', 'classificando', 'renderizando'].includes(e.status))) return
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [editions, load])

  const latestVersion = useMemo(() => {
    const byClient = new Map<string, number>()
    for (const edition of editions) {
      byClient.set(edition.client_id, Math.max(byClient.get(edition.client_id) || 0, edition.version))
    }
    return byClient
  }, [editions])

  const visibleEditions = useMemo(
    () =>
      [...editions].sort((a, b) => {
        const client = (a.clients?.name || '').localeCompare(b.clients?.name || '')
        return client || b.version - a.version
      }),
    [editions]
  )

  async function closeMonth(clientIds?: string[]) {
    setClosing(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/monthly-editions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, client_ids: clientIds, dispatch: true }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao fechar o mês.')
      const created = data?.editions?.length || 0
      const failures = data?.errors?.length || 0
      const dispatchError = data?.dispatch?.error
      setMessage(
        dispatchError
          ? `${created} edição(ões) criada(s), mas o worker não foi acionado: ${dispatchError}`
          : `${created} edição(ões) enviada(s) para geração${failures ? `; ${failures} falha(s)` : ''}.`
      )
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao fechar o mês.')
    } finally {
      setClosing(false)
    }
  }

  async function download(id: string) {
    setError('')
    const res = await fetch(`/api/monthly-editions/${id}/download`)
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      setError(data?.error || 'PDF indisponível.')
      return
    }
    window.location.href = data.url
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-4xl font-light tracking-tight">Fechamentos mensais</h1>
          <p className="text-sm text-gray-500 mt-1">
            Um PDF completo e permanente por cliente. Regenerações criam novas versões.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => closeMonth()} disabled={closing || !period}>
            <CalendarRange className="w-4 h-4 mr-2" />
            {closing ? 'Fechando…' : 'Fechar mês — 5 PDFs'}
          </Button>
        </div>
      </div>

      {message && <div className="border border-blue-200 bg-blue-50 px-4 py-3 text-sm mb-4">{message}</div>}
      {error && <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}

      {loading ? (
        <p className="text-gray-400 py-16 text-center">Carregando…</p>
      ) : visibleEditions.length === 0 ? (
        <div className="border border-gray-200 py-20 text-center text-gray-400">Nenhum fechamento para este mês.</div>
      ) : (
        <div className="border border-gray-200 divide-y divide-gray-100">
          {visibleEditions.map((edition) => (
            <div key={edition.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{edition.clients?.name || 'Cliente'}</p>
                  <span className="text-[11px] uppercase tracking-wider border border-gray-200 px-2 py-0.5">
                    versão {edition.version}
                  </span>
                  {edition.version < (latestVersion.get(edition.client_id) || 0) && (
                    <span className="text-[11px] text-gray-400">versão anterior</span>
                  )}
                  <span
                    className={`text-[11px] uppercase tracking-wider px-2 py-0.5 ${
                      edition.status === 'concluido'
                        ? 'bg-green-50 text-green-700'
                        : edition.status === 'erro'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {STATUS[edition.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {edition.counts?.total || 0} publicações · {edition.counts?.integral || 0} integrais ·{' '}
                  {edition.counts?.parcial || 0} parciais · {edition.counts?.mencoes_diretas || 0} menções diretas
                </p>
                {edition.error && <p className="text-xs text-red-600 mt-1">{edition.error}</p>}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => closeMonth([edition.client_id])}
                disabled={closing || edition.version < (latestVersion.get(edition.client_id) || 0)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerar
              </Button>
              <Button size="sm" onClick={() => download(edition.id)} disabled={edition.status !== 'concluido'}>
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
