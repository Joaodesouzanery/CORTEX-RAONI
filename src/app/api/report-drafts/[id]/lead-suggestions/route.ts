import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { syncLeadSuggestions } from '@/lib/report-automation'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('*').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  const { data, error } = await supabase.from('report_lead_suggestions').select('*').eq('draft_id', id).eq('base_version', draft.base_version).order('rank')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (data?.length) return NextResponse.json(data)
  return NextResponse.json(await syncLeadSuggestions(supabase, draft))
}
