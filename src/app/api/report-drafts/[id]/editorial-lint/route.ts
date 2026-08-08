import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { lintEditorialDirectives } from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const supabase = createClient()
  const [{ data: draft }, { data: sections }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('applied_editorial_snapshot').eq('id', id).single(),
    supabase.from('report_sections').select('section_key, content').eq('draft_id', id).order('section_key'),
  ])
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  const text = typeof body.text === 'string'
    ? body.text
    : (sections || []).map((section) => section.content).join('\n\n')
  const checks = lintEditorialDirectives(text, draft.applied_editorial_snapshot || null)
  return NextResponse.json({
    status: checks.some((check) => check.status === 'blocked') ? 'blocked' : 'passed',
    checks,
  })
}
