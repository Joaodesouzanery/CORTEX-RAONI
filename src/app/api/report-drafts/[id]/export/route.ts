import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { buildAnnex, buildDossier, buildQualifiedSection, evidenceCsv } from '@/lib/report-drafts'
import type { ReportEvidenceItem } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = new URL(req.url).searchParams.get('format') || 'dossier'
  const supabase = createClient()
  const [{ data: draft, error }, { data: items }, { data: sections }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    supabase.from('report_evidence_items').select('*').eq('draft_id', id).order('bucket').order('position'),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const evidence = (items || []) as ReportEvidenceItem[]
  const safeName = `${String(draft.clients?.name || 'cliente').replace(/[^a-z0-9]+/gi, '-')}-${draft.period_month.slice(0, 7)}`
  let content: string
  let contentType: string
  let extension: string
  if (format === 'csv') {
    content = evidenceCsv(evidence)
    contentType = 'text/csv; charset=utf-8'
    extension = 'csv'
  } else if (format === 'annex') {
    content = buildAnnex(evidence)
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else if (format === 'text') {
    content = [
      ...(sections || []).map((section) => section.content).filter(Boolean),
      buildQualifiedSection(evidence),
      '---',
      `*${draft.brand_snapshot?.footer || ''}*`,
    ].join('\n\n')
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else {
    content = buildDossier(evidence)
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  }
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}-${format}.${extension}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}

