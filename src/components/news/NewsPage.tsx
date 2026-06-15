'use client'
import { useState, useEffect } from 'react'
import { useViewMode } from '@/hooks/useViewMode'
import { useArticleSelection } from '@/hooks/useArticleSelection'
import ViewToggle from './ViewToggle'
import SelectAllBar from './SelectAllBar'
import ArticleCardGrid from './ArticleCardGrid'
import ArticleListView from './ArticleListView'
import ReportBuilder from '@/components/report/ReportBuilder'
import type { Article } from '@/types'
import { RefreshCw, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NewsPage() {
  const { mode, toggle } = useViewMode()
  const { selected, toggle: toggleSelect, selectAll, clearAll } = useArticleSelection()
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  useEffect(() => { loadArticles() }, [])

  async function loadArticles() {
    setLoading(true)
    const res = await fetch('/api/articles')
    const data = await res.json()
    setArticles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function fetchNews() {
    setFetching(true)
    await fetch('/api/articles/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manual: true }),
    })
    await loadArticles()
    setFetching(false)
  }

  const selectedArticles = articles.filter((a) => selected.has(a.id))

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <h1 className="text-5xl font-light tracking-tight">The Latest</h1>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchNews} disabled={fetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? 'animate-spin' : ''}`} />
            {fetching ? 'Buscando...' : 'Buscar Notícias'}
          </Button>
          <ViewToggle mode={mode} onToggle={toggle} />
        </div>
      </div>

      {/* Selection bar */}
      <SelectAllBar
        selectedCount={selected.size}
        totalCount={articles.length}
        onSelectAll={() => selectAll(articles.map((a) => a.id))}
        onClear={clearAll}
      />

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
      ) : articles.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <p className="text-lg">Nenhuma notícia ainda.</p>
          <p className="text-sm mt-2">Adicione fontes em <a href="/sources" className="underline">Fontes</a> e clique em &quot;Buscar Notícias&quot;.</p>
        </div>
      ) : mode === 'card' ? (
        <ArticleCardGrid articles={articles} selected={selected} onSelect={toggleSelect} />
      ) : (
        <ArticleListView articles={articles} selected={selected} onSelect={toggleSelect} />
      )}

      {/* Floating Report Button */}
      {selected.size > 0 && (
        <button
          onClick={() => setReportOpen(true)}
          className="fixed bottom-8 right-8 bg-black text-white px-6 py-3 flex items-center gap-2 shadow-xl hover:bg-gray-800 transition-colors z-40"
        >
          <FileText className="w-4 h-4" />
          Gerar Relatório ({selected.size})
        </button>
      )}

      {/* Report Builder Drawer */}
      <ReportBuilder
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        articles={selectedArticles}
        onReportGenerated={() => {}}
      />
    </div>
  )
}
