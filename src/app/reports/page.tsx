'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'
import type { Report } from '@/types'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { describeWhyNoReports, type DraftSummary, type NoReportsDiagnosis } from '@/lib/reports-diagnostics'

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  // Antes era `Array.isArray(d) ? d : []`, sem conferir res.ok: um 500
  // renderizava EXATAMENTE igual a uma tabela vazia, e não havia como saber
  // qual dos dois era.
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [diagnosis, setDiagnosis] = useState<NoReportsDiagnosis | null>(null)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const res = await fetch('/api/reports')
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error((data && data.error) || `O servidor respondeu HTTP ${res.status}.`)
      if (!Array.isArray(data)) throw new Error('Resposta inesperada do servidor ao carregar relatórios.')
      setReports(data as Report[])
      setState('ready')
      // Só no caminho vazio: diz POR QUE não há relatório.
      if (!data.length) {
        const draftsRes = await fetch('/api/report-drafts')
        const drafts = await draftsRes.json().catch(() => null)
        setDiagnosis(describeWhyNoReports(Array.isArray(drafts) ? (drafts as DraftSummary[]) : []))
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao carregar relatórios.')
      setState('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function deleteReport(id: string) {
    if (!confirm('Excluir este relatório permanentemente?')) return
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex justify-between items-center gap-4 mb-8">
        <h1 className="text-3xl font-bold">Relatórios Gerados</h1>
        <Link href="/reports/prepare">
          <Button>Preparação mensal</Button>
        </Link>
      </div>
      {state === 'loading' ? (
        <div className="divide-y border border-gray-200">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="h-8 w-16 flex-shrink-0 animate-pulse bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 animate-pulse bg-gray-100" />
                <div className="h-3 w-1/4 animate-pulse bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      ) : state === 'error' ? (
        <div className="border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">Não foi possível carregar os relatórios.</p>
          <p className="mx-auto mt-1 max-w-xl break-words text-sm text-red-600">{errorMessage}</p>
          <Button variant="outline" className="mt-4" onClick={load}>
            Tentar novamente
          </Button>
        </div>
      ) : reports.length === 0 ? (
        <div className="border border-gray-200 p-8 text-center">
          <p className="font-medium">{diagnosis?.headline || 'Nenhum relatório ainda.'}</p>
          {diagnosis?.detail && (
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">{diagnosis.detail}</p>
          )}
          {diagnosis?.cta && (
            <Link href={diagnosis.cta.href}>
              <Button className="mt-4">{diagnosis.cta.label}</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y border border-gray-200">
          {reports.map((report) => (
            <div key={report.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
              {/* Client logo */}
              {report.clients?.logo_url && (
                <Image
                  src={report.clients.logo_url}
                  alt={report.clients.name}
                  width={64}
                  height={32}
                  unoptimized
                  className="h-8 w-16 object-contain flex-shrink-0"
                />
              )}

              {/* Main content */}
              <Link href={`/reports/${report.id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {report.clients?.name && (
                    <span className="text-xs uppercase tracking-wider bg-black text-white px-2 py-0.5">
                      {report.clients.name}
                    </span>
                  )}
                  <p className="font-medium line-clamp-1">{report.prompt || 'Relatório'}</p>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {report.article_ids.length} artigos · {formatDate(report.created_at)}
                </p>
              </Link>

              {/* Delete button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-red-600 flex-shrink-0"
                onClick={() => deleteReport(report.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
