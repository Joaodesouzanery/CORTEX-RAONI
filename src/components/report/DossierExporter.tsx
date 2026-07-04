'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Article } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  articles: Article[]
  // All client-relevant articles in the period → the full item table + panorama.
  // `articles` (the selection) is the priority subset that gets full text.
  allRelevant?: Article[]
  clientId?: string | null
  clientName?: string | null
}

// Standalone feature: exports a self-contained Markdown briefing PACKAGE (master
// prompt + panorama + full item table + full-text of the selection + previous
// report + design handoff) to paste into Claude Code. Does not touch the AI flow.
export default function DossierExporter({ open, onClose, articles, allRelevant, clientId, clientName }: Props) {
  const [mes, setMes] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [text, setText] = useState<string | null>(null)
  const [csv, setCsv] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const tableCount = (allRelevant && allRelevant.length) || articles.length

  function reset() {
    setText(null)
    setCsv(null)
    setError('')
    setCopied(false)
  }

  async function generate() {
    if (articles.length === 0) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/reports/dossier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          article_ids: articles.map((a) => a.id),
          table_ids: (allRelevant && allRelevant.length ? allRelevant : articles).map((a) => a.id),
          client_id: clientId || null,
          metadata: mes.trim()
            ? { mes: mes.trim(), reunioes_presenciais: 0, reunioes_virtuais: 0, orientacoes: 0, acoes_imprensa: 0 }
            : undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao gerar o dossiê')
      setText(data.text)
      setCsv(data.csv || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar o dossiê')
    } finally {
      setLoading(false)
    }
  }

  async function copy() {
    if (!text) return
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const slug = (clientName || 'cortex').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')

  function downloadBlob(content: string, mime: string, ext: string) {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dossie-${slug}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Exportar dossiê ({articles.length} matérias){clientName ? ` — ${clientName}` : ''}</SheetTitle>
        </SheetHeader>

        {!text ? (
          <div className="mt-6 flex flex-col gap-5">
            <p className="text-sm text-gray-600">
              Gera um <strong>pacote de briefing</strong> pronto para colar no <strong>Claude Code</strong>: prompt mestre + panorama +
              tabela com <strong>{tableCount}</strong> {tableCount === 1 ? 'item' : 'itens'} do mês +
              texto completo das <strong>{articles.length}</strong> selecionadas + relatório do mês anterior + handoff de design.
              A tabela também sai em <strong>.csv</strong> (base da planilha).
            </p>
            <div>
              <Label htmlFor="dmes">Mês de referência (opcional)</Label>
              <Input id="dmes" value={mes} onChange={(e) => setMes(e.target.value)} placeholder="Ex: Junho de 2026" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="dprompt">Contexto adicional (opcional)</Label>
              <Textarea
                id="dprompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: dar ênfase ao tema X neste mês..."
                rows={3}
                className="resize-none mt-1"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={generate} disabled={loading || articles.length === 0} className="w-full h-12 text-base">
              {loading ? 'Gerando dossiê…' : 'Gerar dossiê'}
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap">
              <Button onClick={copy} size="sm">{copied ? '✓ Copiado' : 'Copiar tudo'}</Button>
              <Button variant="outline" onClick={() => text && downloadBlob(text, 'text/markdown', 'md')} size="sm">Baixar .md</Button>
              {csv && (
                <Button variant="outline" onClick={() => downloadBlob(csv, 'text/csv', 'csv')} size="sm">Baixar .csv (base)</Button>
              )}
              <Button variant="outline" onClick={reset} size="sm">← Novo</Button>
            </div>
            <textarea
              readOnly
              value={text}
              className="w-full h-[60vh] border border-gray-200 p-3 text-xs font-mono whitespace-pre-wrap"
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
