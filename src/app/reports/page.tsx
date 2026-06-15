'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import type { Report } from '@/types'

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    fetch('/api/reports').then(r => r.json()).then(d => setReports(Array.isArray(d) ? d : []))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Relatórios Gerados</h1>
      {reports.length === 0 ? (
        <p className="text-gray-500 text-center py-12">Nenhum relatório ainda. Selecione artigos em <Link href="/news" className="underline">Notícias</Link> para gerar um.</p>
      ) : (
        <div className="divide-y border border-gray-200">
          {reports.map((report) => (
            <Link key={report.id} href={`/reports/${report.id}`} className="block p-4 hover:bg-gray-50">
              <p className="font-medium line-clamp-1">{report.prompt}</p>
              <p className="text-sm text-gray-500 mt-1">
                {report.article_ids.length} artigos · {formatDate(report.created_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
