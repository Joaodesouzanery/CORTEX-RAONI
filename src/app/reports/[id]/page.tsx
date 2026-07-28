import { createClient } from '@/lib/supabase/server'
import ReportViewer from '@/components/report/ReportViewer'
import ReportPdfButton from '@/components/report/ReportPdfButton'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: report } = await supabase
    .from('reports')
    .select('*, clients(logo_url)')
    .eq('id', id)
    .single()
  if (!report) notFound()

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm text-gray-500">{formatDate(report.created_at)} · {report.article_ids?.length ?? 0} artigos</p>
        <ReportPdfButton
          prompt={report.prompt}
          content={report.content}
          createdAt={formatDate(report.created_at)}
          logoUrl={(report.clients as { logo_url: string | null } | null)?.logo_url}
        />
      </div>
      <p className="text-lg text-gray-700 italic mb-8 border-l-4 border-black pl-4">{report.prompt}</p>
      <ReportViewer content={report.content} />
    </div>
  )
}
