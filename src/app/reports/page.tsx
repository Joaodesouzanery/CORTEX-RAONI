'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDate } from '@/lib/utils'
import type { Report } from '@/types'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setReports(Array.isArray(d) ? d : []))
  }, [])

  async function deleteReport(id: string) {
    if (!confirm('Excluir este relatório permanentemente?')) return
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    setReports((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Relatórios Gerados</h1>
      {reports.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nenhum relatório ainda. Selecione artigos em <Link href="/news" className="underline">Notícias</Link> para gerar um.</p>
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
