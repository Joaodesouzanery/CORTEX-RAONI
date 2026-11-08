'use client'
import { useEffect, useMemo, useState, useRef } from 'react'
import { CheckSquare, FileDown, FilePlus2, RefreshCw, Sparkles } from 'lucide-react'
import { useViewMode } from '@/hooks/useViewMode'
import { useArticleSelection } from '@/hooks/useArticleSelection'
import { useToast } from '@/hooks/use-toast'
import ViewToggle from './ViewToggle'
import SelectAllBar from './SelectAllBar'
import SourceFilterBar from './SourceFilterBar'
import ArticleCardGrid from './ArticleCardGrid'
import NewsHero from './NewsHero'
import AgendaSidebar from './AgendaSidebar'
import ArticleListView from './ArticleListView'
import PanoramaPanel from './PanoramaPanel'
import SignalsStrip from './SignalsStrip'
import type { TagPatch } from './TagControls'
import ClippingPdfButton from '@/components/report/ClippingPdfButton'
import { Button } from '@/components/ui/button'
import type {
  Article,
  ArticleTag,
  Client,
  FetchRun,
  MonitoringStatus,
  NewsQualificationSummary,
  PaginatedArticles,
  Source,
} from '@/types'
import type { PanoramaRow } from '@/lib/panorama'
import type { TagSuggestion } from '@/lib/ai/classify'
import { createLatestGuard } from '@/lib/latest-request'
import { saoPauloPeriodOf } from '@/lib/sao-paulo-period'
import type { NewsScope } from '@/lib/validation'

const PAGE_SIZE = 100

// Últimos 12 meses: cobre o ciclo anual de relatórios sem lista infinita.
const MONTH_OPTIONS = 12

function monthOptions(): Array<{ value: string; label: string }> {
  const now = new Date()
  return Array.from({ length: MONTH_OPTIONS }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { value, label }
  })
}
const TERMINAL_RUNS = new Set(['concluido', 'parcial', 'erro'])

const SCOPE_TABS: Array<{ value: NewsScope; label: string; hint: string }> = [
  { value: 'relevante', label: 'Cliente + Setor', hint: 'Tudo o que alguma regra de cliente marcou, inclusive o que está em revisão' },
  { value: 'cliente', label: 'Cita o cliente', hint: 'Só matérias que citam o cliente diretamente' },
  { value: 'setor', label: 'Setor', hint: 'Cobertura do setor sem citação direta ao cliente' },
  { value: 'tudo', label: 'Tudo', hint: 'Tudo o que as fontes trouxeram, inclusive o que nenhum cliente quer' },
]

// Coleta pelo botão: um laço só, chamando lote a lote (4 fontes por lote, ver
// claim_fetch_run_sources em process/route.ts). Antes eram dois laços de 40
// voltas em paralelo: quando um não achava fonte livre, gastava as 40 voltas
// em segundos enquanto o outro esperava um lote de 45 s, e o clique terminava
// em "excedeu o número máximo de lotes" com notícias já gravadas.
const SOURCES_PER_BATCH = 4
// 3 voltas por lote cobrem a re-fila de fonte travada (2 tentativas) com folga.
const ROUNDS_PER_BATCH = 3
// Lote vazio com run aberto = outra chamada ainda está processando; espera.
const IDLE_WAIT_MS = 2000
// 502/504 da Vercel em um lote não derruba a coleta inteira.
const TRANSIENT_RETRIES = 3

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function NewsPage() {
  const { mode, toggle } = useViewMode()
  const { selected, toggle: toggleSelect, selectAll, clearAll } = useArticleSelection()
  const { toast } = useToast()
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchRun, setFetchRun] = useState<FetchRun | null>(null)
  // Guarda o ID, não o nome: o `find` por nome quebrava com fontes homônimas.
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // Abas (08/11/2026). Padrão: cliente + setor, INCLUINDO o que está em
  // revisão — é ali que mora o setor. "Tudo" mostra o acervo sem etiqueta.
  const [scope, setScope] = useState<NewsScope>('relevante')
  const [clientLinks, setClientLinks] = useState<Map<string, { priority: number; is_thematic: boolean }> | null>(null)
  const [activePeriod, setActivePeriod] = useState<number | null>(30)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [sources, setSources] = useState<Source[]>([])
  const [activeClient, setActiveClient] = useState<Client | null>(null)
  const [activeStatus, setActiveStatus] = useState<
    Exclude<MonitoringStatus, 'excluido'> | null
  >(null)
  const [manualOnly, setManualOnly] = useState(false)
  const [tagsById, setTagsById] = useState<Map<string, ArticleTag>>(new Map())
  const [suggesting, setSuggesting] = useState(false)
  const [busySelection, setBusySelection] = useState(false)
  const [qualificationSummary, setQualificationSummary] = useState<NewsQualificationSummary | null>(null)
  // Trava: nenhuma busca de artigos sai antes de clientes/fontes e dos
  // parâmetros de URL assentarem. Sem isso, a primeira requisição saía sem
  // client_id e caía no ramo caro (count exato sobre a tabela inteira).
  const [bootstrapped, setBootstrapped] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const articlesGuard = useRef(createLatestGuard())
  const inFlight = useRef<AbortController | null>(null)

  const scores = useMemo(() => {
    if (!activeClient) return null
    return new Map(articles.map((article) => [article.id, article.tag?.match_score || 0]))
  }, [articles, activeClient])
  const allLoadedSelected = articles.length > 0 && articles.every((article) => selected.has(article.id))
  const selectedArticles = articles.filter((article) => selected.has(article.id))
  const pendingTag = useMemo(
    () =>
      activeClient
        ? articles.filter((article) => {
            const tag = tagsById.get(article.id)
            return !tag || tag.tom == null || tag.relevancia == null || tag.cita_cliente == null
          })
        : [],
    [activeClient, articles, tagsById]
  )
  const panoramaRows = useMemo<PanoramaRow[]>(
    () =>
      articles.map((article) => {
        const tag = tagsById.get(article.id) || article.tag
        return {
          tom: tag?.tom ?? null,
          relevancia: tag?.relevancia ?? null,
          cita_cliente: tag?.cita_cliente ?? null,
          categoria: article.sources?.categoria ?? null,
        }
      }),
    [articles, tagsById]
  )

  function articleQuery(cursor?: string | null): URLSearchParams {
    const query = new URLSearchParams({ paginated: 'true', limit: String(PAGE_SIZE) })
    if (cursor) query.set('cursor', cursor)
    if (activeClient) query.set('client_id', activeClient.id)
    if (activeStatus) query.set('status', activeStatus)
    if (manualOnly && activeClient) query.set('origin', 'manual')
    if (activeSourceId) query.set('source_id', activeSourceId)
    if (activePeriod) query.set('days', String(activePeriod))
    if (dateFrom) query.set('published_after', new Date(`${dateFrom}T00:00:00-03:00`).toISOString())
    if (dateTo) query.set('published_before', new Date(`${dateTo}T23:59:59-03:00`).toISOString())
    if (debouncedSearch.trim().length >= 2) query.set('search', debouncedSearch.trim())
    query.set('scope', scope)
    return query
  }

  function summaryQuery(): URLSearchParams {
    const query = articleQuery()
    query.delete('paginated')
    query.delete('limit')
    return query
  }

  async function loadQualificationSummary() {
    if (!activeClient) {
      setQualificationSummary(null)
      return
    }
    const summaryRes = await fetch(`/api/articles/summary?${summaryQuery()}`)
    const summaryData = await summaryRes.json().catch(() => null)
    setQualificationSummary(summaryRes.ok ? (summaryData as NewsQualificationSummary) : null)
  }

  async function loadArticles(reset = true) {
    // Aborta a busca anterior e abre um token. Toda escrita de estado abaixo é
    // precedida de `isCurrent`: sem isso, a requisição que falhou sobrescrevia
    // a que deu certo, e a tela mostrava erro com os artigos já carregados.
    if (reset) inFlight.current?.abort()
    const controller = new AbortController()
    if (reset) inFlight.current = controller
    const token = articlesGuard.current.begin()
    const current = () => articlesGuard.current.isCurrent(token)

    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const cursor = reset ? null : nextCursor
      const res = await fetch(`/api/articles?${articleQuery(cursor)}`, { signal: controller.signal })
      const data = (await res.json().catch(() => null)) as PaginatedArticles | { error?: string } | null
      if (!current()) return
      if (!res.ok || !data || !('items' in data)) {
        throw new Error((data && 'error' in data && data.error) || 'Falha ao carregar notícias.')
      }
      setArticles((previous) => (reset ? data.items : [...previous, ...data.items]))
      setTotal(data.total)
      setNextCursor(data.next_cursor)
      setLoadError(null)
      if (reset) {
        const tagMap = new Map<string, ArticleTag>()
        for (const article of data.items) if (article.tag) tagMap.set(article.id, article.tag)
        setTagsById(tagMap)
        clearAll()
        await loadQualificationSummary()
        if (!current()) return
      } else {
        setTagsById((previous) => {
          const next = new Map(previous)
          for (const article of data.items) if (article.tag) next.set(article.id, article.tag)
          return next
        })
      }
    } catch (error) {
      // Requisição cancelada nunca vira erro na tela nem toast.
      if (error instanceof Error && error.name === 'AbortError') return
      if (!current()) return
      const message = error instanceof Error ? error.message : 'Falha ao carregar notícias.'
      setLoadError(message)
      toast({ title: 'Falha ao carregar notícias', description: message, variant: 'destructive' })
    } finally {
      if (current()) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }

  useEffect(() => {
    // `.then(res => res.json())` sem conferir `res.ok` é o que tornava um 500
    // indistinguível de uma lista vazia: um corpo `{error}` falha no
    // Array.isArray abaixo e vira [] sem sinal nenhum.
    const readJson = async (url: string) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${url} respondeu HTTP ${res.status}`)
      return res.json()
    }
    Promise.all([readJson('/api/clients?active=true'), readJson('/api/sources')])
      .then(([clientRows, sourceRows]) => {
        const clientList = Array.isArray(clientRows) ? (clientRows as Client[]) : []
        setClients(clientList)
        setSources(Array.isArray(sourceRows) ? (sourceRows as Source[]) : [])
        const params = new URLSearchParams(window.location.search)
        const clientId = params.get('client')
        const period = Number.parseInt(params.get('period') || '')
        if ([1, 7, 15, 30].includes(period)) setActivePeriod(period)
        if (clientId) {
          const client = clientList.find((item) => item.id === clientId) || null
          setActiveClient(client)
          if (client && params.get('origin') === 'manual') setManualOnly(true)
        }
      })
      .catch((error) => {
        // Antes isto engolia tudo em silêncio: /api/clients quebrado ficava
        // indistinguível de "nenhum cliente cadastrado".
        setClients([])
        setSources([])
        setBootstrapError(
          error instanceof Error ? error.message : 'Não foi possível carregar clientes e fontes.'
        )
      })
      .finally(() => setBootstrapped(true))
  }, [])

  // 350 ms: evita uma varredura por tecla digitada.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(timer)
  }, [search])

  // Recarrega as fontes com o vínculo do cliente ativo, para o filtro poder
  // agrupar "Fontes deste cliente" no topo.
  useEffect(() => {
    if (!bootstrapped) return
    if (!activeClient) {
      setClientLinks(null)
      return
    }
    let cancelled = false
    fetch(`/api/sources?client_id=${activeClient.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return
        const links = new Map<string, { priority: number; is_thematic: boolean }>()
        for (const row of rows as Array<Source & { client_sources?: Array<{ priority: number; is_thematic: boolean }> }>) {
          const link = row.client_sources?.[0]
          if (link) links.set(row.id, { priority: link.priority, is_thematic: link.is_thematic })
        }
        setClientLinks(links)
      })
      .catch(() => {
        if (!cancelled) setClientLinks(null)
      })
    return () => {
      cancelled = true
    }
  }, [bootstrapped, activeClient?.id])

  useEffect(() => {
    if (!bootstrapped) return
    loadArticles(true)
  }, [
    bootstrapped,
    activeClient?.id,
    activeSourceId,
    activeStatus,
    manualOnly,
    activePeriod,
    dateFrom,
    dateTo,
    debouncedSearch,
    scope,
  ])

  async function processRun(runId: string, totalSources: number): Promise<FetchRun> {
    let latest: FetchRun | null = null
    const maxRounds = Math.max(10, Math.ceil(totalSources / SOURCES_PER_BATCH) * ROUNDS_PER_BATCH)
    let transient = 0
    for (let round = 0; round < maxRounds; round++) {
      const res = await fetch(`/api/fetch-runs/${runId}/process`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        if ([502, 503, 504].includes(res.status) && transient < TRANSIENT_RETRIES) {
          transient++
          await wait(IDLE_WAIT_MS)
          continue
        }
        throw new Error(data?.error || `Falha ao processar lote de fontes (HTTP ${res.status}).`)
      }
      transient = 0
      latest = data.run as FetchRun
      setFetchRun(latest)
      if (TERMINAL_RUNS.has(latest.status)) return latest
      if (!Array.isArray(data.results) || data.results.length === 0) await wait(IDLE_WAIT_MS)
    }
    throw new Error('A coleta não terminou no tempo do botão; ela segue na próxima coleta agendada.')
  }

  async function fetchNews() {
    setFetching(true)
    let runId: string | null = null
    try {
      const res = await fetch('/api/fetch-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_type: 'manual' }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.run) throw new Error(data?.error || 'Falha ao iniciar a coleta.')
      setFetchRun(data.run as FetchRun)
      if (data.cooldown) {
        toast({ title: 'Fontes já atualizadas', description: 'A última coleta terminou há menos de dez minutos.' })
        return
      }
      runId = String(data.run.id)
      const latest = await processRun(runId, Number(data.run.total_sources) || 0)
      toast({
        title: latest.status === 'concluido' ? 'Coleta concluída' : 'Coleta concluída com ressalvas',
        description: `${latest.inserted_count} novas, ${latest.updated_count} enriquecidas e ${latest.error_count} fontes com erro.`,
      })
    } catch (error) {
      toast({
        title: 'Coleta interrompida',
        description: `${error instanceof Error ? error.message : 'Erro desconhecido'} O que já foi coletado aparece abaixo.`,
        variant: 'destructive',
      })
    } finally {
      // Recarrega sempre: lote gravado antes do erro já é notícia na base, e
      // a lista parada fazia parecer que nada tinha chegado.
      if (runId) {
        const detail = await fetch(`/api/fetch-runs/${runId}`)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null)
        if (detail) setFetchRun(detail as FetchRun)
      }
      await loadArticles(true).catch(() => undefined)
      setFetching(false)
    }
  }

  async function handleTag(articleId: string, patch: TagPatch) {
    if (!activeClient) return
    const previous = tagsById.get(articleId) || null
    const optimistic: ArticleTag = {
      article_id: articleId,
      client_id: activeClient.id,
      tom: previous?.tom ?? null,
      relevancia: previous?.relevancia ?? null,
      cita_cliente: previous?.cita_cliente ?? null,
      tema: previous?.tema ?? null,
      ...previous,
      ...patch,
      classification_source: 'humano',
    }
    setTagsById((current) => new Map(current).set(articleId, optimistic))
    try {
      const res = await fetch('/api/articles/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: articleId, client_id: activeClient.id, ...patch }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar a classificação.')
      setTagsById((current) => new Map(current).set(articleId, data as ArticleTag))
      await loadQualificationSummary()
    } catch (error) {
      setTagsById((current) => {
        const next = new Map(current)
        if (previous) next.set(articleId, previous)
        else next.delete(articleId)
        return next
      })
      toast({
        title: 'Não foi possível salvar a classificação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  async function runSuggestTags() {
    if (!activeClient || !pendingTag.length) return
    setSuggesting(true)
    try {
      const suggestionRes = await fetch('/api/articles/tag/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id, article_ids: pendingTag.map((article) => article.id) }),
      })
      const suggestionData = await suggestionRes.json().catch(() => null)
      if (!suggestionRes.ok) throw new Error(suggestionData?.error || 'Falha ao sugerir tags.')
      const suggestions = (suggestionData?.suggestions || []) as TagSuggestion[]
      const bulkRes = await fetch('/api/articles/tag/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: activeClient.id, items: suggestions }),
      })
      const saved = await bulkRes.json().catch(() => null)
      if (!bulkRes.ok) throw new Error(saved?.error || 'Falha ao aplicar sugestões.')
      setTagsById((current) => {
        const next = new Map(current)
        for (const tag of saved as ArticleTag[]) next.set(tag.article_id, tag)
        return next
      })
      await loadQualificationSummary()
      toast({ title: `${(saved as ArticleTag[]).length} matérias classificadas` })
    } catch (error) {
      toast({
        title: 'Não foi possível sugerir tags',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSuggesting(false)
    }
  }

  async function addToPreparation() {
    if (!activeClient || !selectedArticles.length) return
    setBusySelection(true)
    try {
      const dated = selectedArticles.find((article) => article.published_at)?.published_at
      const selectedPeriod = saoPauloPeriodOf(dated || new Date())
      const create = async (newVersion: boolean) =>
        fetch('/api/report-drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: activeClient.id,
            period: selectedPeriod,
            monthly_instructions: '',
            service_metrics: {},
            new_version: newVersion,
          }),
        })
      let prepareRes = await create(false)
      let prepareData = await prepareRes.json().catch(() => null)
      if (prepareRes.status === 409) {
        prepareRes = await create(true)
        prepareData = await prepareRes.json().catch(() => null)
      }
      if (!prepareRes.ok) throw new Error(prepareData?.error || 'Falha ao abrir a preparação mensal.')
      const draftId = String((prepareData.draft || prepareData).id)
      const assignRes = await fetch(`/api/report-drafts/${draftId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_ids: selectedArticles.map((article) => article.id) }),
      })
      const assignData = await assignRes.json().catch(() => null)
      if (!assignRes.ok) throw new Error(assignData?.error || 'Falha ao adicionar as matérias.')
      window.location.href = `/reports/prepare?client=${activeClient.id}&period=${selectedPeriod}&draft=${draftId}`
    } catch (error) {
      toast({
        title: 'Não foi possível adicionar à preparação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setBusySelection(false)
    }
  }

  return (
    <>
    <NewsHero onPickClient={(id) => setActiveClient(clients.find((client) => client.id === id) || null)} />
    <div className="mx-auto max-w-screen-xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-light tracking-tight text-slate-900 sm:text-5xl">Últimas notícias</h2>
          <p className="mt-1 text-xs text-gray-400">
            {/* Sem cliente a contagem do servidor é estimada (o count exato varria
                a tabela inteira). O ≈ é obrigatório: número sem procedência
                declarada é o que a regra de métrica honesta proíbe. */}
            {activeClient ? '' : '≈ '}
            {total.toLocaleString('pt-BR')} publicações no filtro · carregadas {articles.length}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (allLoadedSelected ? clearAll() : selectAll(articles.map((article) => article.id)))}
            disabled={!articles.length}
          >
            <CheckSquare className="mr-2 h-4 w-4" />
            {allLoadedSelected ? 'Limpar seleção' : `Selecionar carregadas (${articles.length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchNews} disabled={fetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
            {fetching && fetchRun
              ? `${fetchRun.completed_sources}/${fetchRun.total_sources}`
              : fetching
                ? 'Iniciando…'
                : 'Buscar Notícias'}
          </Button>
          {activeClient && (
            <Button variant="outline" size="sm" onClick={runSuggestTags} disabled={suggesting || !pendingTag.length}>
              <Sparkles className={`mr-2 h-4 w-4 ${suggesting ? 'animate-pulse' : ''}`} />
              {suggesting ? 'Sugerindo…' : `Sugerir tags (${pendingTag.length})`}
            </Button>
          )}
          {activeClient && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/api/articles/export?${summaryQuery()}`} download>
                <FileDown className="mr-2 h-4 w-4" />
                {`Exportar CSV (${total})`}
              </a>
            </Button>
          )}
          <ViewToggle mode={mode} onToggle={toggle} />
        </div>
      </div>

      {fetchRun && (
        <div className="mb-5 border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <div className="flex justify-between gap-4">
            <span>
              Coleta {fetchRun.status}: {fetchRun.completed_sources}/{fetchRun.total_sources} fontes
            </span>
            <span className="tabular-nums">
              {fetchRun.inserted_count} novas · {fetchRun.updated_count} enriquecidas · {fetchRun.error_count} erros
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden bg-gray-200">
            <div
              className="h-full bg-black transition-all"
              style={{ width: `${fetchRun.total_sources ? (fetchRun.completed_sources / fetchRun.total_sources) * 100 : 0}%` }}
            />
          </div>
          {fetchRun.source_results?.some((row) => row.error) && (
            <ul className="mt-2 text-xs text-red-600">
              {fetchRun.source_results.filter((row) => row.error).map((row) => (
                <li key={row.source_id}>{row.sources?.name || row.source_id}: {row.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <SelectAllBar selectedCount={selected.size} totalCount={articles.length} onSelectAll={() => selectAll(articles.map((article) => article.id))} onClear={clearAll} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([null, 1, 7, 15, 30] as Array<number | null>).map((days) => (
          <button
            key={days ?? 'all'}
            onClick={() => setActivePeriod(days)}
            className={`border px-3 py-1 text-xs uppercase tracking-widest ${
              activePeriod === days ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600 hover:border-black'
            }`}
          >
            {days == null ? 'Todos' : days === 1 ? '1 dia' : `${days} dias`}
          </button>
        ))}
        <span className="ml-2 text-xs uppercase tracking-widest text-gray-500">De</span>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="border border-gray-300 px-2 py-1 text-xs" />
        <span className="text-xs uppercase tracking-widest text-gray-500">Até</span>
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="border border-gray-300 px-2 py-1 text-xs" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-gray-500">Cliente:</span>
        <select
          value={activeClient?.id || ''}
          onChange={(event) => {
            const client = clients.find((item) => item.id === event.target.value) || null
            setActiveClient(client)
            if (!client) setManualOnly(false)
          }}
          className="border border-gray-300 bg-white px-2 py-1 text-xs"
        >
          <option value="">Todos</option>
          {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
        {activeClient && <span className="text-xs text-gray-500">Total inclusivo classificado no servidor</span>}
        {activeClient && (
          <select
            value={activeStatus || ''}
            onChange={(event) =>
              setActiveStatus(
                (event.target.value ||
                  null) as Exclude<MonitoringStatus, 'excluido'> | null
              )
            }
            className="border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">Todos os status</option>
            <option value="confirmado">Confirmadas</option>
            <option value="candidato">Candidatas</option>
            <option value="revisao">Em revisão</option>
          </select>
        )}
        {activeClient && (
          <button
            type="button"
            aria-pressed={manualOnly}
            onClick={() => setManualOnly((current) => !current)}
            className={`border px-3 py-1 text-xs uppercase tracking-widest ${
              manualOnly
                ? 'border-black bg-black text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-black'
            }`}
          >
            Enviadas por mim
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <SourceFilterBar
          sources={sources}
          activeSourceId={activeSourceId}
          onChange={setActiveSourceId}
          clientLinks={clientLinks}
        />
        {/* A rota sempre soube buscar por título e filtrar menção direta;
            nenhum dos dois estava exposto na tela até agora. */}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar no título…"
          className="w-56 border border-gray-300 px-3 py-1 text-xs outline-none focus:border-black"
        />
        {/* Mês fechado do cliente: reaproveita o intervalo de datas da rota em
            vez de um parâmetro novo, então o Panorama e a lista batem. */}
        <select
          aria-label="Mês"
          value={dateFrom && dateTo && dateFrom.endsWith('-01') && dateFrom.slice(0, 7) === dateTo.slice(0, 7) ? dateFrom.slice(0, 7) : ''}
          onChange={(event) => {
            const month = event.target.value
            if (!month) {
              setDateFrom('')
              setDateTo('')
              setActivePeriod(30)
              return
            }
            const [year, mon] = month.split('-').map(Number)
            const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate()
            setActivePeriod(null)
            setDateFrom(`${month}-01`)
            setDateTo(`${month}-${String(lastDay).padStart(2, '0')}`)
          }}
          className="rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-black"
        >
          <option value="">Mês: todos</option>
          {monthOptions().map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1" role="tablist" aria-label="Escopo das notícias">
          {SCOPE_TABS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={scope === tab.value}
              onClick={() => setScope(tab.value)}
              title={tab.hint}
              className={`border px-3 py-1 text-xs transition-colors ${
                scope === tab.value ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-600 hover:border-black'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeClient && (
        <div>
          {/* Sinais acima do Panorama, na mesma tela que produziu os números. */}
          <SignalsStrip client={activeClient} summary={qualificationSummary} />
          <p className="mb-2 text-xs text-gray-500">
            Panorama calculado no servidor sobre todo o filtro, independentemente das {articles.length} matérias carregadas.
          </p>
          <PanoramaPanel
            rows={panoramaRows}
            panorama={qualificationSummary?.panorama}
            funnel={qualificationSummary?.funnel}
            clientName={activeClient.name}
          />
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-gray-400">Carregando notícias…</div>
      ) : loadError || bootstrapError ? (
        <div className="py-24 text-center">
          <p className="text-lg text-red-600">
            {bootstrapError ? 'Não foi possível carregar clientes e fontes.' : 'Não foi possível carregar as notícias.'}
          </p>
          <p className="mx-auto mt-2 max-w-xl break-words text-sm text-red-500">{bootstrapError || loadError}</p>
        </div>
      ) : !articles.length ? (
        <div className="py-24 text-center text-gray-400">Nenhuma publicação encontrada no filtro.</div>
      ) : mode === 'card' ? (
        <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
          <ArticleCardGrid articles={articles} selected={selected} onSelect={toggleSelect} scores={scores} />
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <AgendaSidebar />
            </div>
          </div>
        </div>
      ) : (
        <ArticleListView
          articles={articles}
          selected={selected}
          onSelect={toggleSelect}
          scores={scores}
          clientId={activeClient?.id ?? null}
          tagsById={tagsById}
          onTag={handleTag}
        />
      )}

      {nextCursor && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" onClick={() => loadArticles(false)} disabled={loadingMore}>
            {loadingMore ? 'Carregando…' : `Carregar mais (${articles.length}/${total})`}
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-8 right-8 z-40 flex items-center gap-3">
          {activeClient && (
            <button
              onClick={addToPreparation}
              disabled={busySelection}
              className="flex items-center gap-2 border border-black bg-white px-5 py-3 shadow-xl disabled:opacity-50"
            >
              <FilePlus2 className="h-4 w-4" />
              {busySelection ? 'Adicionando…' : `Adicionar à preparação (${selected.size})`}
            </button>
          )}
          <ClippingPdfButton articles={selectedArticles} clientId={activeClient?.id} clientName={activeClient?.name} logoUrl={activeClient?.logo_url} />
        </div>
      )}
    </div>
    </>
  )
}
