import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { syncDraftClusters } from '@/lib/report-automation'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data, error } = await supabase.from('report_clusters').select('*').eq('draft_id', id).order('article_count', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    return NextResponse.json(await syncDraftClusters(createClient(), id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao agrupar pautas.' }, { status: 500 })
  }
}
