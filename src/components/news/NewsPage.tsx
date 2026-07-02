'use client'
import { useState, useEffect, useMemo } from 'react'
import { useViewMode } from '@/hooks/useViewMode'
import { useArticleSelection } from '@/hooks/useArticleSelection'
import ViewToggle from './ViewToggle'
import SelectAllBar from './SelectAllBar'
import SourceFilterBar from './SourceFilterBar'
import ArticleCardGrid from './ArticleCardGrid'
import ArticleListView from './ArticleListView'
import ReportBuilder from '@/components/report/ReportBuilder'
import DossierExporter from '@/components/report/DossierExporter'
import { parseKeywords, isRelevant, relevanceScore, expandTerms } from '@/lib/relevance'
import type { Article, Client } from '@/types'
import { RefreshCw, FileText, FileDown, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FetchSourceResult {
  source: string
  fetched?: number
  error?: string
}

// Generalist firehose feeds: their articles only show in the default "relevant"
// view when they match a client's terms. Every other (thematic/specialized) feed
// is on-topic by construction and always passes.
const GENERAL_SOURCES = new Set([
  'Carta Capital',
  'Metrópoles',
  'Poder360',
  'Folha de S.Paulo',
  'Brasil Journal',
  'Exame',
  'G1',
  'O Globo',
  'Estadão',
  'Agência Estado / Broadcast',
  'Brasil 247',
  'Google News — Brasil (manchetes)',
])

export default function NewsPage() {
  const { mode, toggle } = useViewMode()
  const { selected, toggle: toggleSelect, selectAll, clearAll } = useArticleSelection()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [dossierOpen, setDossierOpen] = useState(false)
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [activePeriod, setActivePeriod] = useState<number | null>(null)
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [fetchResults, setFetchResults] = useState<FetchSourceResult[] | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [activeClient, setActiveClient] = useState<Client | null>(null)
  const [showAll, setShowAll] = useState(false)

  const sources = useMemo(
    () => Array.from(new Set(articles.map((a) => a.sources?.name).filter(Boolean))) as string[],
    [articles]
  )

  const periodFiltered = useMemo(() => {
    if (!activePeriod) return articles
    const cutoff = Date.now() - activePeriod * 24 * 60 * 60 * 1000
    return articles.filter((a) => a.published_at && new Date(a.published_at).getTime() >= cutoff)
  }, [articles, activePeriod])

  const dateFiltered = useMemo(() => {
    let result = periodFiltered
    if (dateFrom) {
      const start = new Date(dateFrom).getTime()
      result = result.filter((a) => a.published_at && new Date(a.published_at).getTime() >= start)
    }
    if (dateTo) {
      const end = new Date(dateTo)
      end.setHours(23, 59, 59, 999)
      result = result.filter((a) => a.published_at && new Date(a.published_at).getTime() <= end.getTime())
    }
    return result
  }, [periodFiltered, dateFrom, dateTo])

  const parsedKws = useMemo(
    () => parseKeywords(expandTerms(activeClient?.keywords, activeClient?.synonyms)),
    [activeClient]
  )

  // Union of every client's terms — drives the default "relevant to the portfolio"
  // view when no single client is selected.
  const allClientsParsed = useMemo(() => {
    const terms: string[] = []
    for (const c of clients) terms.push(...expandTerms(c.keywords, c.synonyms))
    return parseKeywords(terms)
  }, [clients])

  const clientFiltered = useMemo(() => {
    if (activeClient) {
      // A specific client is selected → strict relevance by its terms.
      if (!parsedKws.length) return dateFiltered
      return dateFiltered.filter((a) => isRelevant(parsedKws, { title: a.title, excerpt: a.excerpt }))
    }
    // No client selected → default to what's relevant to the whole portfolio:
    // anything from a thematic/specialized feed, OR matching any client's terms.
    // "Ver tudo" bypasses this to show the raw firehose.
    if (showAll || !allClientsParsed.length) return dateFiltered
    return dateFiltered.filter(
      (a) =>
        !GENERAL_SOURCES.has(a.sources?.name || '') ||
        isRelevant(allClientsParsed, { title: a.title, excerpt: a.excerpt })
    )
  }, [dateFiltered, activeClient, parsedKws, allClientsParsed, showAll])

  // Apply the source filter, then — when a client is active — rank by relevance
  // (score desc, date desc) and expose a score map for the relevance badge.
  const { filtered, scores } = useMemo(() => {
    const base = activeSource
      ? clientFiltered.filter((a) => a.sources?.name === activeSource)
      : clientFiltered
    if (!parsedKws.length) return { filtered: base, scores: null as Map<string, number> | null }
    const m = new Map<string, number>()
    for (const a of base) m.set(a.id, relevanceScore(parsedKws, { title: a.title, excerpt: a.excerpt }))
    const dateOf = (x: Article) => (x.published_at ? new Date(x.published_at).getTime() : 0)
    const ranked = [...base].sort((a, b) => (m.get(b.id)! - m.get(a.id)!) || (dateOf(b) - dateOf(a)))
    return { filtered: ranked, scores: m }
  }, [clientFiltered, activeSource, parsedKws])

  useEffect(() => {
    loadArticles()
    fetch('/api/clients').then(r => r.json()).then(d => {
      const list: Client[] = Array.isArray(d) ? d : []
      setClients(list)
      // Pre-select a client coming from the dashboard (/news?client=ID).
      const cid = new URLSearchParams(window.location.search).get('client')
      if (cid) {
        const c = list.find((x) => x.id === cid)
        if (c) setActiveClient(c)
      }
    })
  }, [])

  // Auto-select the client's relevant articles when a client is picked, so the
  // user can jump straight to generating a report.
  useEffect(() => {
    if (activeClient) selectAll(filtered.map((a) => a.id))
    // Only react to the chosen client (not to every filter change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient?.id])

  async function loadArticles() {
    setLoading(true)
    const res = await fetch('/api/articles?limit=1000')
    const data = await res.json()
    setArticles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function fetchNews() {
    setFetching(true)
    try {
      const res = await fetch('/api/articles/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      })
      const data = await res.json().catch(() => null)
      if (data?.sources) {
        setFetchResults(data.sources)
        setShowDiagnostics(true)
      }
    } finally {
      await loadArticles()
      setFetching(false)
    }
  }

  const selectedArticles = articles.filter((a) => selected.has(a.id))
  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id))

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-5xl font-light tracking-tight">As últimas notícias</h1>
          <p className="text-xs text-gray-400 mt-1">Marque os checkboxes para selecionar notícias e gerar um relatório</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (allFilteredSelected ? clearAll() : selectAll(filtered.map((a) => a.id)))}
            disabled={filtered.length === 0}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            {allFilteredSelected
              ? 'Limpar seleção'
              : `${activeClient ? 'Selecionar relevantes' : 'Selecionar todas'} (${filtered.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchNews} disabled={fetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Buscando...' : 'Buscar Notícias'}
          </Button>
          <ViewToggle mode={mode} onToggle={toggle} />
        </div>
      </div>

      {/* Fetch diagnostics */}
      {fetchResults && (
        <div className="mb-4 border border-gray-200 text-sm">
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100"
          >
            <span>
              Resultado da busca:{' '}
              {fetchResults.filter((r) => r.error).length} fonte(s) com erro,{' '}
              {fetchResults.filter((r) => !r.error).length} ok
            </span>
            <span className="text-gray-400">{showDiagnostics ? '▲' : '▼'}</span>
          </button>
          {showDiagnostics && (
            <ul className="divide-y divide-gray-100">
              {fetchResults.map((r) => (
                <li key={r.source} className="flex items-center justify-between px-4 py-1.5">
                  <span>{r.source}</span>
                  {r.error ? (
                    <span className="text-red-600">✗ {r.error}</span>
                  ) : (
                    <span className="text-green-600">✓ {r.fetched ?? 0} artigos</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Selection bar */}
      <SelectAllBar
        selectedCount={selected.size}
        totalCount={filtered.length}
        onSelectAll={() => selectAll(filtered.map((a) => a.id))}
        onClear={clearAll}
      />

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([null, 1, 7, 15, 30] as (number | null)[]).map((days) => (
          <button
            key={days ?? 'all'}
            onClick={() => setActivePeriod(days)}
            className={`px-3 py-1 text-xs uppercase tracking-widest border transition-colors ${
              activePeriod === days
                ? 'bg-black text-white border-black'
                : 'border-gray-300 text-gray-600 hover:border-black hover:text-black'
            }`}
          >
            {days === null ? 'Todos' : days === 1 ? '1 Dia' : `${days} Dias`}
          </button>
        ))}

        {/* Custom date range */}
        <div className="flex items-center gap-2 ml-2 text-xs text-gray-600">
          <span className="uppercase tracking-widest">De</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 px-2 py-1 focus:border-black outline-none"
          />
          <span className="uppercase tracking-widest">Até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 px-2 py-1 focus:border-black outline-none"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="underline hover:no-underline"
            >
              Limpar datas
            </button>
          )}
        </div>
      </div>

      {/* Client filter */}
      {clients.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs uppercase tracking-widest text-gray-500">Cliente:</span>
          <select
            value={activeClient?.id || ''}
            onChange={(e) => {
              const c = clients.find((c) => c.id === e.target.value) || null
              setActiveClient(c)
            }}
            className="border border-gray-300 text-xs px-2 py-1 focus:border-black outline-none bg-white"
          >
            <option value="">Todos</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {activeClient ? (
            <span className="text-xs text-gray-500">
              Filtrando por: <strong>{activeClient.keywords?.join(', ')}</strong>
            </span>
          ) : (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="text-xs underline text-gray-500 hover:text-black"
              title="Alternar entre só notícias relevantes aos clientes e o feed completo"
            >
              {showAll ? 'Ver só relevantes' : 'Ver tudo (sem filtro)'}
            </button>
          )}
        </div>
      )}

      {/* Source filter */}
      <SourceFilterBar sources={sources} active={activeSource} onChange={setActiveSource} />

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 w-32 mb-2" />
              <div className="aspect-video bg-gray-200 mb-3" />
              <div className="h-5 bg-gray-200 mb-2" />
              <div className="h-4 bg-gray-200 w-3/4 mb-1" />
              <div className="h-4 bg-gray-200 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">Nenhuma notícia ainda.</p>
          <p className="text-sm mt-2">Adicione fontes em <a href="/sources" className="underline">Fontes</a> e clique em &quot;Buscar Notícias&quot;.</p>
        </div>
      ) : mode === 'card' ? (
        <ArticleCardGrid articles={filtered} selected={selected} onSelect={toggleSelect} scores={scores} />
      ) : (
        <ArticleListView articles={filtered} selected={selected} onSelect={toggleSelect} scores={scores} />
      )}

      {/* Floating action buttons */}
      {selected.size > 0 && (
        <div className="fixed bottom-8 right-8 flex items-center gap-3 z-40">
          <button
            onClick={() => setDossierOpen(true)}
            className="bg-white text-black border border-black px-5 py-3 flex items-center gap-2 shadow-xl hover:bg-gray-50 transition-colors"
          >
            <FileDown className="w-4 h-4" />
            Exportar dossiê ({selected.size})
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="bg-black text-white px-6 py-3 flex items-center gap-2 shadow-xl hover:bg-gray-800 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Gerar Relatório ({selected.size})
          </button>
        </div>
      )}

      {/* Report Builder Drawer */}
      <ReportBuilder
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        articles={selectedArticles}
        onReportGenerated={() => {}}
        clientId={activeClient?.id}
        clientName={activeClient?.name}
        contratante={activeClient?.contratante}
      />

      {/* Dossier Exporter (separate feature) */}
      <DossierExporter
        open={dossierOpen}
        onClose={() => setDossierOpen(false)}
        articles={selectedArticles}
        clientId={activeClient?.id}
        clientName={activeClient?.name}
      />
    </div>
  )
}
