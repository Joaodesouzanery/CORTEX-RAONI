'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Article } from '@/types'
import { runSectionedReport } from '@/lib/report-runner'
import ReportViewer from './ReportViewer'

interface Props {
  open: boolean
  onClose: () => void
  articles: Article[]
  onReportGenerated: () => void
  clientId?: string | null
  clientName?: string | null
  contratante?: string | null
}

export default function ReportBuilder({ open, onClose, articles, onReportGenerated, clientId, clientName, contratante }: Props) {
  const [mes, setMes] = useState('')
  const [reunioesPres, setReunioesPres] = useState('')
  const [reunioesVirt, setReunioesVirt] = useState('')
  const [orientacoes, setOrientacoes] = useState('')
  const [acoesImprensa, setAcoesImprensa] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [error, setError] = useState('')
  const [report, setReport] = useState<{ id: string; content: string } | null>(null)

  function reset() {
    setReport(null)
    setMes('')
    setReunioesPres('')
    setReunioesVirt('')
    setOrientacoes('')
    setAcoesImprensa('')
    setPrompt('')
    setError('')
    setProgress(null)
  }

  async function generate() {
    if (!mes.trim() || articles.length === 0) return
    setLoading(true)
    setError('')

    const basePayload = {
      prompt,
      article_ids: articles.map((a) => a.id),
      client_id: clientId || null,
      metadata: {
        mes: mes.trim(),
        reunioes_presenciais: parseInt(reunioesPres) || 0,
        reunioes_virtuais: parseInt(reunioesVirt) || 0,
        orientacoes: parseInt(orientacoes) || 0,
        acoes_imprensa: parseInt(acoesImprensa) || 0,
      },
    }

    try {
      const content = await runSectionedReport({
        basePayload,
        articles,
        contratante,
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      })

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...basePayload, content }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar o relatório')
      setReport(data)
      onReportGenerated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const canGenerate = mes.trim() && articles.length > 0 && !loading

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gerar Relatório Mensal ({articles.length} artigos){clientName ? ` — ${clientName}` : ''}</SheetTitle>
        </SheetHeader>

        {!report ? (
          <div className="mt-6 flex flex-col gap-5">
            {/* Selected articles */}
            <div>
              <p className="text-sm font-semibold mb-2 uppercase tracking-wider">Artigos Selecionados</p>
              <ul className="text-sm text-gray-600 space-y-1 max-h-36 overflow-y-auto border border-gray-100 p-2">
                {articles.map((a) => (
                  <li key={a.id} className="truncate">• {a.title}</li>
                ))}
              </ul>
            </div>

            <hr />

            {/* Required metadata */}
            <div>
              <p className="text-sm font-semibold mb-3 uppercase tracking-wider">Dados do Período</p>
              <div className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="mes">Mês de Referência *</Label>
                  <Input
                    id="mes"
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    placeholder="Ex: Junho de 2026"
                    className="mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rpres">Reuniões Presenciais</Label>
                    <Input
                      id="rpres"
                      type="number"
                      min="0"
                      value={reunioesPres}
                      onChange={(e) => setReunioesPres(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rvirt">Reuniões Virtuais</Label>
                    <Input
                      id="rvirt"
                      type="number"
                      min="0"
                      value={reunioesVirt}
                      onChange={(e) => setReunioesVirt(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="orient">Orientações Estratégicas</Label>
                    <Input
                      id="orient"
                      type="number"
                      min="0"
                      value={orientacoes}
                      onChange={(e) => setOrientacoes(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="imprensa">Ações com a Imprensa</Label>
                    <Input
                      id="imprensa"
                      type="number"
                      min="0"
                      value={acoesImprensa}
                      onChange={(e) => setAcoesImprensa(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr />

            {/* Optional additional context */}
            <div>
              <Label htmlFor="prompt">Contexto Adicional (opcional)</Label>
              <p className="text-xs text-gray-500 mt-0.5 mb-1">O Prompt Mestre já está configurado. Use este campo para adicionar contexto específico do mês, eventos relevantes ou instruções adicionais.</p>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Este mês houve uma crise específica com X. Dar ênfase especial ao tema Y..."
                rows={4}
                className="resize-none mt-1"
              />
            </div>

            <Button onClick={generate} disabled={!canGenerate} className="w-full h-12 text-base">
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  {progress
                    ? `Gerando ${Math.min(progress.done + 1, progress.total)}/${progress.total} — ${progress.label}…`
                    : 'Gerando relatório…'}
                </span>
              ) : (
                'Gerar Relatório com IA'
              )}
            </Button>
            {loading && progress && (
              <div className="h-1 w-full bg-gray-100 overflow-hidden -mt-2">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600 text-center -mt-2">{error}</p>
            )}
            {!mes.trim() && !loading && (
              <p className="text-xs text-red-500 text-center -mt-3">* Mês de referência é obrigatório</p>
            )}
          </div>
        ) : (
          <div className="mt-6">
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button variant="outline" onClick={reset} size="sm">
                ← Novo Relatório
              </Button>
              <a href={`/reports/${report.id}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Ver página completa ↗</Button>
              </a>
            </div>
            {report.content.includes('MODO MOCK') && (
              <div className="mb-4 border border-amber-300 bg-amber-50 text-amber-800 text-sm px-3 py-2">
                ⚠️ Relatório de demonstração (modo mock). Configure a variável <strong>ANTHROPIC_API_KEY</strong> no ambiente para gerar com IA real.
              </div>
            )}
            <ReportViewer content={report.content} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
