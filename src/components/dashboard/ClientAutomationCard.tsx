'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertTriangle, Download, FileText, Play, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { DashboardClientSummary } from '@/types'

/**
 * Estágios da máquina de estados agrupados no que o operador reconhece.
 * A ordem espelha o mapa NEXT em src/lib/report-automation-worker.ts.
 */
const STAGE_STRIP = [
  { label: 'Base', stages: ['ensure_draft', 'refresh_base', 'clusters'] },
  { label: 'Triagem', stages: ['triage'] },
  { label: 'Verificação', stages: ['verify'] },
  { label: 'Agenda', stages: ['topics', 'lead_suggestions', 'auto_lead'] },
  { label: 'Qualidade', stages: ['comparison', 'change_summary', 'quality', 'checklist', 'park'] },
  { label: 'Seções', stages: ['sections'] },
  { label: 'Pacote', stages: ['quality_final', 'complete'] },
] as const

const METRIC_FIELDS = [
  { key: 'reunioes_presenciais', label: 'Reuniões presenciais' },
  { key: 'reunioes_virtuais', label: 'Reuniões virtuais' },
  { key: 'orientacoes', label: 'Orientações' },
  { key: 'acoes_imprensa', label: 'Ações de imprensa' },
] as const

function stageIndex(stage: string | null) {
  if (!stage) return -1
  return STAGE_STRIP.findIndex((group) => (group.stages as readonly string[]).includes(stage))
}

type Props = {
  row: DashboardClientSummary
  busy: boolean
  onPrepare: () => void
  onContinue: () => void
  onOpenExceptions: () => void
  onChanged: () => void
}

export default function ClientAutomationCard({ row, busy, onPrepare, onContinue, onOpenExceptions, onChanged }: Props) {
  const { client, total, triaged_count, qualified_count, annex_count, pending_count, variation_percent, readiness } = row
  const [confirming, setConfirming] = useState<'metrics' | 'lead' | null>(null)
  const [metrics, setMetrics] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const status = readiness?.automation_status || null
  const reason = readiness?.blocking_reason || null
  const current = stageIndex(readiness?.stage || null)

  async function confirmMetrics() {
    if (!readiness?.draft_id) return
    setSaving(true)
    setError('')
    try {
      const payload = Object.fromEntries(
        METRIC_FIELDS.map((field) => [
          field.key,
          Number(metrics[field.key] ?? readiness.service_metrics?.[field.key] ?? 0) || 0,
        ])
      )
      const res = await fetch(`/api/report-drafts/${readiness.draft_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_metrics: payload }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao confirmar indicadores.')
      setConfirming(null)
      onChanged()
    } catch (metricsError) {
      setError(metricsError instanceof Error ? metricsError.message : 'Falha ao confirmar indicadores.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmLead() {
    if (!readiness?.draft_id || !readiness.lead_suggestion) return
    setSaving(true)
    setError('')
    try {
      // Esta rota é a que carimba a atestação humana no artigo. Por isso ela
      // só é chamada a partir de um clique — nunca pela automação.
      const res = await fetch(`/api/report-drafts/${readiness.draft_id}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ article_id: readiness.lead_suggestion.article_id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Falha ao confirmar a matéria principal.')
      setConfirming(null)
      onChanged()
    } catch (leadError) {
      setError(leadError instanceof Error ? leadError.message : 'Falha ao confirmar a matéria principal.')
    } finally {
      setSaving(false)
    }
  }

  const prepareHref = readiness?.draft_id
    ? `/reports/prepare?draft=${readiness.draft_id}`
    : `/reports/prepare?client=${client.id}&period=${readiness?.period || ''}`

  function primaryAction() {
    if (status === 'waiting_configuration') {
      return (
        <Button disabled title="Configure ANTHROPIC_API_KEY para a automação seguir" className="w-full">
          <AlertTriangle className="mr-2 h-4 w-4" />
          Configurar IA
        </Button>
      )
    }
    if (status === 'waiting_review') {
      if (reason === 'exceptions') {
        return (
          <Button onClick={onOpenExceptions} className="w-full">
            Revisar {readiness?.pending_exceptions || 0} exceção(ões)
          </Button>
        )
      }
      if (reason === 'lead') {
        return (
          <Button onClick={() => setConfirming(confirming === 'lead' ? null : 'lead')} className="w-full">
            Confirmar matéria principal
          </Button>
        )
      }
      if (reason === 'service_metrics') {
        return (
          <Button onClick={() => setConfirming(confirming === 'metrics' ? null : 'metrics')} className="w-full">
            Confirmar indicadores
          </Button>
        )
      }
      return (
        <Link href={prepareHref} className="block">
          <Button variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            Resolver na preparação
          </Button>
        </Link>
      )
    }
    if (status === 'running' || status === 'partial') {
      return (
        <Button onClick={onContinue} disabled={busy} className="w-full">
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
          Continuar
        </Button>
      )
    }
    if (status === 'error') {
      return (
        <Button onClick={onContinue} disabled={busy} variant="outline" className="w-full">
          Tentar novamente
        </Button>
      )
    }
    if (status === 'complete' && readiness?.draft_id) {
      if (readiness.package_ready) {
        return (
          <a href={`/api/report-drafts/${readiness.draft_id}/export?format=claude-package`} className="block">
            <Button className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Baixar pacote
            </Button>
          </a>
        )
      }
      return (
        <Link href={prepareHref} className="block">
          <Button variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            Preparação
          </Button>
        </Link>
      )
    }
    return (
      <Button onClick={onPrepare} disabled={busy || total === 0} className="w-full">
        <Play className="mr-2 h-4 w-4" />
        Preparar mês
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 border border-gray-200 p-5">
      <div className="flex items-center gap-3">
        {client.logo_url && (
          <Image src={client.logo_url} alt={client.name} width={64} height={32} unoptimized className="h-8 w-16 object-contain" />
        )}
        <div className="min-w-0">
          <p className="truncate font-semibold">{client.name}</p>
          {client.sector && <p className="truncate text-xs text-gray-500">{client.sector}</p>}
        </div>
      </div>

      <div>
        <span className="text-4xl font-light tabular-nums">{qualified_count}</span>
        <span className="ml-1 text-xs text-gray-500">evidências qualificadas</span>
        <p className="mt-1 text-[11px] text-gray-400">
          {total} candidatas · {triaged_count} triadas · {pending_count} pendentes · {annex_count} no anexo
          {variation_percent != null && ` · ${variation_percent >= 0 ? '+' : ''}${variation_percent}%`}
        </p>
      </div>

      <div className="flex gap-1" title={readiness?.stage ? `Estágio: ${readiness.stage}` : 'Automação não iniciada'}>
        {STAGE_STRIP.map((group, index) => {
          const done = status === 'complete' || (current >= 0 && index < current)
          const active = current === index
          return (
            <div key={group.label} className="flex-1">
              <div
                className={`h-1 ${done ? 'bg-emerald-500' : active ? 'bg-black' : 'bg-gray-200'}`}
                aria-label={group.label}
              />
              <p className={`mt-1 truncate text-[9px] uppercase tracking-wider ${active ? 'text-black' : 'text-gray-400'}`}>
                {group.label}
              </p>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-500">
        Preparação de {readiness?.period}: {readiness?.verified_evidence || 0} verificadas ·{' '}
        {readiness?.covered_topics || 0}/{readiness?.required_topics || 0} tópicos ·{' '}
        {readiness?.sections_done || 0}/9 seções · {readiness?.pending_exceptions || 0} exceções
      </p>

      {status === 'waiting_configuration' && (
        <p className="border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
          Automação aguardando configuração
          {readiness?.automation_error ? `: ${readiness.automation_error}` : ''}
        </p>
      )}
      {status === 'error' && readiness?.automation_error && (
        <p className="border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-700">{readiness.automation_error}</p>
      )}
      {readiness?.service_metrics_source === 'herdado' && (
        <p className="text-[11px] text-amber-700">
          Indicadores herdados do mês anterior — a seção 9 sai com [A PREENCHER] até a confirmação.
        </p>
      )}

      {error && <p className="text-[11px] text-red-600">{error}</p>}

      {confirming === 'lead' && readiness?.lead_suggestion && (
        <div className="border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Sugestão da automação</p>
          <p className="mt-1 text-xs font-medium leading-snug">{readiness.lead_suggestion.title}</p>
          <p className="mt-1 text-[11px] text-gray-500">{readiness.lead_suggestion.rationale}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={confirmLead} disabled={saving}>
              Confirmar
            </Button>
            <Link href={prepareHref}>
              <Button size="sm" variant="outline">
                Trocar
              </Button>
            </Link>
          </div>
        </div>
      )}

      {confirming === 'metrics' && (
        <div className="border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">Indicadores do mês</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {METRIC_FIELDS.map((field) => (
              <label key={field.key} className="text-[11px] text-gray-600">
                {field.label}
                <Input
                  type="number"
                  min={0}
                  className="mt-1 h-8"
                  value={metrics[field.key] ?? String(readiness?.service_metrics?.[field.key] ?? 0)}
                  onChange={(event) => setMetrics((prev) => ({ ...prev, [field.key]: event.target.value }))}
                />
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-3" onClick={confirmMetrics} disabled={saving}>
            Confirmar
          </Button>
        </div>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1">
        <div className="flex-1">{primaryAction()}</div>
        <Link href={prepareHref} className="whitespace-nowrap text-xs text-gray-500 hover:underline">
          Preparação ↗
        </Link>
      </div>
    </div>
  )
}
