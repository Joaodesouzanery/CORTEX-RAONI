'use client'
import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseKeywords, isRelevant, expandTerms } from '@/lib/relevance'
import { runSectionedReport } from '@/lib/report-runner'
import type { Article, Client } from '@/types'
import { FileText } from 'lucide-react'

const PERIODS: { label: string; days: number | null }[] = [
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: '30 dias', days: 30 },
  { label: 'Todos', days: null },
]

function relevantArticles(client: Client, articles: Article[], cutoffMs: number | null): Article[] {
  const inPeriod = cutoffMs
    ? articles.filter((a) => a.published_at && new Date(a.published_at).getTime() >= cutoffMs)
    : articles
  const kws = parseKeywords(expandTerms(client.keywords, client.synonyms))
  if (!kws.length) return []
  return inPeriod.filter((a) => isRelevant(kws, { title: a.title, excerpt: a.excerpt }))
}

interface BatchResult {
  client: string
  ok: boolean
  reportId?: string
  error?: string
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [periodDays, setPeriodDays] = useState<number | null>(30)

  // Batch state
  const [batchOpen, setBatchOpen] = useState(false)
  const [mes, setMes] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{ i: number; total: number; client: string; label: string } | null>(null)
  const [results, setResults] = useState<BatchResult[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((r) => r.json()).catch(() => []),
      fetch('/api/articles?limit=1000').then((r) => r.json()).catch(() => []),
    ]).then(([c, a]) => {
      setClients(Array.isArray(c) ? c : [])
      setArticles(Array.isArray(a) ? a : [])
      setLoading(false)
    })
  }, [])

  const cutoffMs = periodDays ? Date.now() - periodDays * 86400000 : null

  const rows = useMemo(
    () =>
      clients
        .map((c) => ({ client: c, relevant: relevantArticles(c, articles, cutoffMs) }))
        .sort((a, b) => b.relevant.length - a.relevant.length),
    [clients, articles, cutoffMs]
  )

  function openBatch() {
    // Default-select clients that have at least one relevant article.
    setSelectedIds(new Set(rows.filter((r) => r.relevant.length > 0).map((r) => r.client.id)))
    setResults([])
    setBatchOpen(true)
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runBatch() {
    if (!mes.trim()) return
    const targets = rows.filter((r) => selectedIds.has(r.client.id))
    setRunning(true)
    setResults([])
    const out: BatchResult[] = []
    for (let i = 0; i < targets.length; i++) {
      const { client, relevant } = targets[i]
      if (relevant.length === 0) {
        out.push({ client: client.name, ok: false, error: 'Sem notícias relevantes no período' })
        setResults([...out])
        continue
      }
      try {
        const basePayload = {
          prompt: '',
          article_ids: relevant.map((a) => a.id),
          client_id: client.id,
          metadata: { mes: mes.trim(), reunioes_presenciais: 0, reunioes_virtuais: 0, orientacoes: 0, acoes_imprensa: 0 },
        }
        const content = await runSectionedReport({
          basePayload,
          articles: relevant,
          contratante: client.contratante,
          onProgress: (_done, _total, label) =>
            setBatchProgress({ i: i + 1, total: targets.length, client: client.name, label }),
        })
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, content }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || 'Falha ao salvar')
        out.push({ client: client.name, ok: true, reportId: data.id })
      } catch (e) {
        out.push({ client: client.name, ok: false, error: e instanceof Error ? e.message : 'Erro' })
      }
      setResults([...out])
    }
    setBatchProgress(null)
    setRunning(false)
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-5xl font-light tracking-tight">Painel</h1>
          <p className="text-xs text-gray-400 mt-1">Notícias relevantes por cliente e geração de relatórios em lote</p>
        </div>
        <Button onClick={openBatch} disabled={loading || clients.length === 0}>
          <FileText className="w-4 h-4 mr-2" />
          Gerar relatórios do mês
        </Button>
      </div>

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-xs uppercase tracking-widest text-gray-500 mr-1">Período:</span>
        {PERIODS.map((p) => (
          <button
            key={p.label}
            onClick={() => setPeriodDays(p.days)}
            className={`px-3 py-1 text-xs uppercase tracking-widest border transition-colors ${
              periodDays === p.days ? 'bg-black text-white border-black' : 'border-gray-300 text-gray-600 hover:border-black'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">Nenhum cliente cadastrado.</p>
          <p className="text-sm mt-2">Cadastre clientes em <a href="/clients" className="underline">Clientes</a>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map(({ client, relevant }) => (
            <div key={client.id} className="border border-gray-200 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                {client.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={client.logo_url} alt={client.name} className="h-8 w-16 object-contain flex-shrink-0" />
                ) : null}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{client.name}</p>
                  {client.sector && <p className="text-xs text-gray-500 truncate">{client.sector}</p>}
                </div>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-3xl font-light">{relevant.length}</span>
                  <span className="text-xs text-gray-500 ml-1">relevantes</span>
                  {!client.keywords?.length && (
                    <p className="text-[11px] text-amber-600 mt-1">Sem palavras-chave cadastradas</p>
                  )}
                </div>
                <a href={`/news?client=${client.id}`} className="text-sm text-black hover:underline">
                  Ver notícias ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch modal */}
      {batchOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !running && setBatchOpen(false)}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-light mb-1">Gerar relatórios do mês</h2>
            <p className="text-xs text-gray-500 mb-4">
              Um relatório por cliente, com os artigos relevantes do período. Os números de atividade (reuniões etc.) entram como 0 — regenere um cliente individualmente para preenchê-los.
            </p>

            <label className="text-sm font-semibold">Mês de referência *</label>
            <Input value={mes} onChange={(e) => setMes(e.target.value)} placeholder="Ex: Junho de 2026" className="mt-1 mb-4" disabled={running} />

            <p className="text-sm font-semibold mb-2">Clientes</p>
            <div className="border border-gray-100 divide-y divide-gray-100 mb-4 max-h-60 overflow-y-auto">
              {rows.map(({ client, relevant }) => {
                const res = results.find((r) => r.client === client.name)
                return (
                  <label key={client.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(client.id)}
                      onChange={() => toggle(client.id)}
                      disabled={running || relevant.length === 0}
                    />
                    <span className="flex-1 truncate">{client.name}</span>
                    <span className="text-xs text-gray-400">{relevant.length} rel.</span>
                    {res && (res.ok ? <span className="text-green-600 text-xs">✓</span> : <span className="text-red-600 text-xs" title={res.error}>✗</span>)}
                  </label>
                )
              })}
            </div>

            {batchProgress && (
              <p className="text-sm text-gray-600 mb-3">
                Gerando {batchProgress.i}/{batchProgress.total} — <strong>{batchProgress.client}</strong> ({batchProgress.label})…
              </p>
            )}

            {results.length > 0 && !running && (
              <div className="text-sm mb-3">
                {results.filter((r) => r.ok).length} gerado(s), {results.filter((r) => !r.ok).length} com erro.{' '}
                <a href="/reports" className="underline">Ver em Relatórios ↗</a>
              </div>
            )}

            <div className="flex gap-2 justify-end">
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
