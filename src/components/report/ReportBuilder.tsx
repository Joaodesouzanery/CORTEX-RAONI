'use client'
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Article } from '@/types'
import ReportViewer from './ReportViewer'

interface Props {
  open: boolean
  onClose: () => void
  articles: Article[]
  onReportGenerated: () => void
}

export default function ReportBuilder({ open, onClose, articles, onReportGenerated }: Props) {
  const [mes, setMes] = useState('')
  const [reunioesPres, setReunioesPres] = useState('')
  const [reunioesVirt, setReunioesVirt] = useState('')
  const [orientacoes, setOrientacoes] = useState('')
  const [acoesImprensa, setAcoesImprensa] = useState('')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<{ id: string; content: string } | null>(null)

  function reset() {
    setReport(null)
    setMes('')
    setReunioesPres('')
    setReunioesVirt('')
    setOrientacoes('')
    setAcoesImprensa('')
    setPrompt('')
  }

  async function generate() {
    if (!mes.trim() || articles.length === 0) return
    setLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          article_ids: articles.map((a) => a.id),
          metadata: {
            mes: mes.trim(),
            reunioes_presenciais: parseInt(reunioesPres) || 0,
            reunioes_virtuais: parseInt(reunioesVirt) || 0,
            orientacoes: parseInt(orientacoes) || 0,
            acoes_imprensa: parseInt(acoesImprensa) || 0,
          },
        }),
      })
      const data = await res.json()
      setReport(data)
      onReportGenerated()
    } finally {
      setLoading(false)
    }
  }

  const canGenerate = mes.trim() && articles.length > 0 && !loading

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Gerar Relatório Mensal ({articles.length} artigos)</SheetTitle>
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
                  Gerando relatório... (pode levar 1-3 minutos)
                </span>
              ) : (
                'Gerar Relatório com IA'
              )}
            </Button>
            {!mes.trim() && (
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
            <ReportViewer content={report.content} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
