'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Article } from '@/types'
import ReportViewer from './ReportViewer'

interface Props {
  open: boolean
  onClose: () => void
  articles: Article[]
  onReportGenerated: () => void
}

export default function ReportBuilder({ open, onClose, articles, onReportGenerated }: Props) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<{ id: string; content: string } | null>(null)

  async function generate() {
    if (!prompt.trim() || articles.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, article_ids: articles.map((a) => a.id) }),
      })
      const data = await res.json()
      setReport(data)
      onReportGenerated()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gerar Relatório ({articles.length} artigos)</SheetTitle>
        </SheetHeader>

        {!report ? (
          <div className="mt-6 flex flex-col gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Artigos selecionados:</p>
              <ul className="text-sm text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                {articles.map((a) => (
                  <li key={a.id} className="truncate">• {a.title}</li>
                ))}
              </ul>
            </div>

            <div>
              <label className="text-sm font-medium block mb-2">
                Prompt para o relatório
              </label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Analise as tendências de mercado descritas nestas notícias, com foco em oportunidades de investimento..."
                rows={6}
                className="resize-none"
              />
            </div>

            <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full">
              {loading ? 'Gerando relatório...' : 'Gerar Relatório com IA'}
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex gap-2 mb-4">
              <Button variant="outline" onClick={() => setReport(null)} size="sm">
                ← Novo Relatório
              </Button>
              <a href={`/reports/${report.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Ver página completa</Button>
              </a>
            </div>
            <ReportViewer content={report.content} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
