'use client'
import { useState, useEffect, useMemo } from 'react'
import { useViewMode } from '@/hooks/useViewMode'
import { useArticleSelection } from '@/hooks/useArticleSelection'
import ViewToggle from './ViewToggle'
import SelectAllBar from './SelectAllBar'
import SourceFilterBar from './SourceFilterBar'
import ArticleCardGrid from './ArticleCardGrid'
import ArticleListView from './ArticleListView'
import PanoramaPanel from './PanoramaPanel'
import type { TagPatch } from './TagControls'
import ReportBuilder from '@/components/report/ReportBuilder'
import DossierExporter from '@/components/report/DossierExporter'
import ClippingPdfButton from '@/components/report/ClippingPdfButton'
import { parseKeywords, isRelevant, relevanceScore, expandTerms, dedupeByTitle } from '@/lib/relevance'
import { fetchArticlesWindow } from '@/lib/articles'
import type { PanoramaRow } from '@/lib/panorama'
import type { TagSuggestion } from '@/lib/ai/classify'
import type { Article, Client, ArticleTag } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { RefreshCw, FileText, FileDown, CheckSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FetchSourceResult {
  source: string
  fetched?: number
  error?: string
}

// Generalist firehose feeds (sources.is_general): only show in the default
// "relevant" (no-client) view when they match a client's terms; thematic feeds
// always pass. The flag lives in the DB (migration 022), not a hard-coded list.

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
  // Reputational tags for the active client (article_id → tag). Powers the panel
  // and the per-row TagControls. Empty when no client is selected.
  const [tagsById, setTagsById] = useState<Map<string, ArticleTag>>(new Map())
  const [suggesting, setSuggesting] = useState(false)
  // Non-null when the last load failed (DB/env outage). Lets the UI show the real
  // error instead of the misleading "Nenhuma notícia ainda." empty state.
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toast } = useToast()

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
      // A specific client is selected → relevant = matches its terms OR comes from
      // one of its thematic feeds (the feed IS the client's curated stream).
      const feeds = activeClient.feed_names || []
      if (!parsedKws.length && !feeds.length) return dateFiltered
      return dateFiltered.filter(
        (a) =>
          (parsedKws.length > 0 && isRelevant(parsedKws, { title: a.title, excerpt: a.excerpt })) ||
          feeds.includes(a.sources?.name || '')
      )
    }
    // No client selected → default to what's relevant to the whole portfolio:
    // anything from a thematic/specialized feed, OR matching any client's terms.
    // "Ver tudo" bypasses this to show the raw firehose.
    if (showAll || !allClientsParsed.length) return dateFiltered
    return dateFiltered.filter(
      (a) =>
        !a.sources?.is_general ||
        isRelevant(allClientsParsed, { title: a.title, excerpt: a.excerpt })
    )
  }, [dateFiltered, activeClient, parsedKws, allClientsParsed, showAll])

  // Source selected → show ALL from that source (no dedup). Otherwise → the
  // general/client view, with duplicates collapsed. When a client is active, rank
  // by relevance (score desc, date desc) and expose a score map for the badge.
  const { filtered, scores } = useMemo(() => {
    let base: Article[]
    if (activeSource) {
      const src = activeClient ? clientFiltered : dateFiltered
      base = src.filter((a) => a.sources?.name === activeSource)
    } else {
      base = dedupeByTitle(clientFiltered)
    }
    if (!parsedKws.length) return { filtered: base, scores: null as Map<string, number> | null }
    const m = new Map<string, number>()
    for (const a of base) m.set(a.id, relevanceScore(parsedKws, { title: a.title, excerpt: a.excerpt }))
    const dateOf = (x: Article) => (x.published_at ? new Date(x.published_at).getTime() : 0)
    const ranked = [...base].sort((a, b) => (m.get(b.id)! - m.get(a.id)!) || (dateOf(b) - dateOf(a)))
    return { filtered: ranked, scores: m }
  }, [clientFiltered, dateFiltered, activeSource, activeClient, parsedKws])

  // Monitored universe for the panorama = the client-relevant items in the period
  // (deduped), independent of the transient source filter — the "234 itens
  // monitorados" base. Each row reduced to its tag + source type.
  const monitored = useMemo(() => dedupeByTitle(clientFiltered), [clientFiltered])
  const panoramaRows = useMemo<PanoramaRow[]>(
    () =>
      monitored.map((a) => {
        const t = tagsById.get(a.id)
        return {
          tom: t?.tom ?? null,
          relevancia: t?.relevancia ?? null,
          cita_cliente: t?.cita_cliente ?? null,
          categoria: a.sources?.categoria ?? null,
        }
      }),
    [monitored, tagsById]
  )

  // Previous equal-length period → the panorama trend. Client-side, from the
  // loaded window; only for a preset period with no custom date range.
  const trend = useMemo(() => {
    if (!activeClient || !activePeriod || dateFrom || dateTo) return null
    const p = activePeriod
    const now = Date.now()
    const curStart = now - p * 86400000
    const prevStart = now - 2 * p * 86400000
    const feeds = activeClient.feed_names || []
    const relevant = (a: Article) =>
      (parsedKws.length > 0 && isRelevant(parsedKws, { title: a.title, excerpt: a.excerpt })) ||
      feeds.includes(a.sources?.name || '')
    const ms = (a: Article) => (a.published_at ? new Date(a.published_at).getTime() : 0)
    const rel = articles.filter(relevant)
    const prevArts = dedupeByTitle(rel.filter((a) => ms(a) >= prevStart && ms(a) < curStart))
    const prevRows: PanoramaRow[] = prevArts.map((a) => {
      const t = tagsById.get(a.id)
      return { tom: t?.tom ?? null, relevancia: t?.relevancia ?? null, cita_cliente: t?.cita_cliente ?? null, categoria: a.sources?.categoria ?? null }
    })
    const oldest = Math.min(...articles.map(ms).filter((x) => x > 0))
    const partial = Number.isFinite(oldest) && prevStart < oldest
    return { prevRows, partial }
  }, [activeClient, activePeriod, dateFrom, dateTo, parsedKws, articles, tagsById])

  // Only items missing at least one tag dimension need a suggestion — re-classifying
  // already-tagged items just wastes AI calls (bulk apply is fill-only anyway).
  const pendingTag = useMemo(
    () =>
      monitored.filter((a) => {
        const t = tagsById.get(a.id)
        return !t || t.tom == null || t.relevancia == null || t.cita_cliente == null
      }),
    [monitored, tagsById]
  )

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

  // Load the active client's reputational tags (per-client curation state).
  useEffect(() => {
    if (!activeClient) {
      setTagsById(new Map())
      return
    }
    let cancelled = false
    fetch(`/api/articles/tag?client_id=${activeClient.id}`)
      .then((r) => r.json())
      .then((d: ArticleTag[]) => {
        if (cancelled) return
        const m = new Map<string, ArticleTag>()
        if (Array.isArray(d)) for (const t of d) m.set(t.article_id, t)
        setTagsById(m)
      })
      .catch(() => {
        if (!cancelled) setTagsById(new Map())
      })
    return () => {
      cancelled = true
    }
    // Refetch only when the selected client changes, not on every client edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClient?.id])

  // Optimistic tag write: update the map now, persist, revert + toast on failure.
  async function handleTag(articleId: string, patch: TagPatch) {
    if (!activeClient) return
    const prev = tagsById.get(articleId) ?? null
    const optimistic: ArticleTag = {
      article_id: articleId,
      client_id: activeClient.id,
      tom: prev?.tom ?? null,
      relevancia: prev?.relevancia ?? null,
      cita_cliente: prev?.cita_cliente ?? null,
      tema: prev?.tema ?? null,
      ...patch,
    }
    setTagsById((m) => new Map(m).set(articleId, optimistic))
    try {
      const res = await fetch('/api/articles/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, client_id: activeClient.id, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar a classificação')
      setTagsById((m) => new Map(m).set(articleId, data as ArticleTag))
    } catch (e) {
      setTagsById((m) => {
        const n = new Map(m)
        if (prev) n.set(articleId, prev)
        else n.delete(articleId)
        return n
      })
      toast({
        title: 'Não foi possível salvar a classificação',
        description: (e as Error).message,
        variant: 'destructive',
      })
    }
  }

  // Suggest tags for the monitored set (deterministic; AI when the key is set),
  // then apply as fill-only via /bulk — never overwriting a tag set by hand.
  async function runSuggestTags() {
    if (!activeClient) return
    if (pendingTag.length === 0) {
      toast({ title: 'Tudo já classificado', description: 'Nenhuma matéria pendente de tag neste período.' })
      return
    }
    setSuggesting(true)
    try {
      const sres = await fetch('/api/articles/tag/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id, article_ids: pendingTag.map((a) => a.id) }),
      })
      const sdata = await sres.json().catch(() => null)
      if (!sres.ok) throw new Error(sdata?.error || 'Falha ao sugerir tags')
      const suggestions = (sdata?.suggestions ?? []) as TagSuggestion[]
      if (!suggestions.length) throw new Error('Nenhuma sugestão gerada')

      const bres = await fetch('/api/articles/tag/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id, items: suggestions }),
      })
      const saved = await bres.json().catch(() => null)
      if (!bres.ok) throw new Error(saved?.error || 'Falha ao aplicar sugestões')

      setTagsById((m) => {
        const n = new Map(m)
        for (const t of saved as ArticleTag[]) n.set(t.article_id, t)
        return n
      })
      toast({
        title: `${(saved as ArticleTag[]).length} matérias classificadas`,
        description:
          sdata.mode === 'ai'
            ? 'Sugestões geradas com IA (Anthropic). Revise os pills.'
            : 'Modo heurístico — defina ANTHROPIC_API_KEY para ligar a IA. Revise os pills.',
      })
    } catch (e) {
      toast({ title: 'Não foi possível sugerir tags', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSuggesting(false)
    }
  }

  async function loadArticles() {
    setLoading(true)
    // Page through the window so the period buttons filter over ALL articles, not
    // just the newest 1000 (which the high-volume general feeds would monopolize).
    // 60d so the panorama trend can compare the current period to the previous
    // equal-length one (e.g. last 30 days vs. the 30 before it).
    try {
      const data = await fetchArticlesWindow(60)
      setArticles(data)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
      toast({ title: 'Falha ao carregar notícias', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
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
      // Antes um 500 (banco fora, service key ausente) virava `data = null` e o
      // botão não dizia nada. Agora surface o erro em vez de falhar em silêncio.
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`
        toast({ title: 'Falha ao buscar notícias', description: msg, variant: 'destructive' })
        return
      }
      if (data?.sources) {
        setFetchResults(data.sources)
        setShowDiagnostics(true)
        const results = data.sources as FetchSourceResult[]
        const total = results.reduce((n, r) => n + (r.fetched ?? 0), 0)
        if (total === 0) {
          toast({
            title: 'Nenhum artigo novo',
            description: 'As fontes não trouxeram itens novos — veja o diagnóstico por fonte.',
          })
        }
      }
    } catch (e) {
      toast({ title: 'Falha ao buscar notícias', description: (e as Error).message, variant: 'destructive' })
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
          {activeClient && (
            <Button
              variant="outline"
              size="sm"
              onClick={runSuggestTags}
              disabled={suggesting || pendingTag.length === 0}
              title="Preenche tom/relevância/cita das matérias ainda não classificadas"
            >
              <Sparkles className={`w-4 h-4 mr-2 ${suggesting ? 'animate-pulse' : ''}`} />
              {suggesting ? 'Sugerindo...' : `Sugerir tags (${pendingTag.length})`}
            </Button>
          )}
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

      {/* Live panorama — deterministic, from the active client's tags */}
      {activeClient && (
        <PanoramaPanel
          rows={panoramaRows}
          clientName={activeClient.name}
          prevRows={trend?.prevRows}
          prevPartial={trend?.partial}
        />
      )}

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
      ) : loadError ? (
        <div className="text-center py-24">
          <p className="text-lg text-red-600">Não foi possível carregar as notícias.</p>
          <p className="text-sm mt-2 text-red-500 break-words max-w-xl mx-auto">{loadError}</p>
          <p className="text-sm mt-3 text-gray-400 max-w-xl mx-auto">
            Provável falha de conexão com o banco (Supabase) — verifique se o projeto não está pausado e se as variáveis
            de ambiente do deploy estão definidas. Depois recarregue a página.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">Nenhuma notícia ainda.</p>
          <p className="text-sm mt-2">Adicione fontes em <a href="/sources" className="underline">Fontes</a> e clique em &quot;Buscar Notícias&quot;.</p>
        </div>
      ) : mode === 'card' ? (
        <ArticleCardGrid articles={filtered} selected={selected} onSelect={toggleSelect} scores={scores} />
      ) : (
        <ArticleListView
          articles={filtered}
          selected={selected}
          onSelect={toggleSelect}
          scores={scores}
          clientId={activeClient?.id ?? null}
          tagsById={tagsById}
          onTag={handleTag}
        />
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
          <ClippingPdfButton
            articles={selectedArticles}
            clientId={activeClient?.id}
            clientName={activeClient?.name}
            logoUrl={activeClient?.logo_url}
          />
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
        allRelevant={filtered}
        clientId={activeClient?.id}
        clientName={activeClient?.name}
      />
    </div>
  )
}
