'use client'
import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReportEvidenceItem } from '@/types'
import { safeExternalUrl } from '@/lib/url'

type QueueItem = ReportEvidenceItem & { exception_priority?: number | null }

type Props = {
  draftId: string
  clientId: string
  clientName: string
  onClose: () => void
  /** Chamado quando a fila esvazia, para o Painel retomar o tick sozinho. */
  onDrained: () => void
}

const ROLES = [
  { key: 'evidencia', label: 'Evidência', score: 85, confidence: 1 },
  { key: 'contexto', label: 'Contexto', score: 45, confidence: 0.7 },
  { key: 'ruido', label: 'Ruído', score: 10, confidence: 0.95 },
] as const

/**
 * A única contribuição humana obrigatória num mês normal.
 *
 * `evaluateReportQuality` bloqueia enquanto qualquer item que cite o cliente ou
 * tenha tom negativo/crítico estiver com `editorial_review_state` diferente de
 * 'revisado' — e nada automático pode escrever esse valor. Trazer a fila para
 * o Painel evita a viagem até a tela de preparação de 1490 linhas.
 */
export default function ExceptionQueueDrawer({ draftId, clientId, clientName, onClose, onDrained }: Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/report-drafts/${draftId}/review-queue`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar a fila de exceções.')
      setItems((data.items || []) as QueueItem[])
      setError('')
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Falha ao carregar a fila de exceções.')
    } finally {
      setLoading(false)
    }
  }, [draftId])

  useEffect(() => {
    load()
  }, [load])

  async function decide(item: QueueItem, role: (typeof ROLES)[number]) {
    setBusy(item.article_id)
    setError('')
    try {
      const res = await fetch('/api/articles/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article_id: item.article_id,
          client_id: clientId,
          monitoring_status: 'confirmado',
          report_role: role.key,
          report_role_source: 'humano',
          editorial_score: role.score,
          editorial_confidence: role.confidence,
          editorial_review_state: 'revisado',
          editorial_reason: 'Decisão manual na fila de exceções do Painel.',
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao salvar decisão.')
      const remaining = items.filter((row) => row.article_id !== item.article_id)
      setItems(remaining)
      if (!remaining.length) {
        await fetch(`/api/report-drafts/${draftId}/refresh`, { method: 'POST' })
        onDrained()
      }
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : 'Falha ao salvar decisão.')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-2xl font-light">Fila de exceções</h2>
            <p className="mt-1 text-xs text-gray-500">
              {clientName} · {items.length} item(ns) aguardando decisão humana
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-black">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-6 text-sm text-gray-400">Carregando exceções…</p>
          ) : !items.length ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-500">Nenhuma exceção pendente.</p>
              <p className="mt-1 text-xs text-gray-400">A automação pode seguir para as seções.</p>
            </div>
          ) : (
            items.map((item) => {
              const classification = item.classification_snapshot
              const article = item.article_snapshot
              return (
                <div key={item.article_id} className="border-b border-gray-100 px-6 py-4">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-gray-400">
                    <span>{String(article.publisher || article.source_name || 'veículo não identificado')}</span>
                    {classification.cita_cliente === true && (
                      <span className="border border-black px-1.5 py-0.5 text-black">cita cliente</span>
                    )}
                    {['negativo', 'critico'].includes(String(classification.tom || '')) && (
                      <span className="border border-red-300 bg-red-50 px-1.5 py-0.5 text-red-700">
                        {String(classification.tom)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    {safeExternalUrl(article.url) ? (
                      <a href={safeExternalUrl(article.url)!} target="_blank" rel="noreferrer" className="hover:underline">
                        {String(article.title)}
                      </a>
                    ) : (
                      String(article.title)
                    )}
                  </p>
                  {Boolean(classification.editorial_reason) && (
                    <p className="mt-1 text-xs text-gray-500">{String(classification.editorial_reason)}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROLES.map((role) => (
                      <Button
                        key={role.key}
                        variant="outline"
                        size="sm"
                        disabled={busy === item.article_id}
                        onClick={() => decide(item, role)}
                      >
                        {role.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
