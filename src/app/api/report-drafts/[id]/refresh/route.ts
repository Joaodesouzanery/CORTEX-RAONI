import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { refreshDraftEvidence } from '@/lib/report-drafts'
import { syncDraftEditorialSnapshot } from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: draft, error } = await supabase.from('monthly_report_drafts').select('*').eq('id', id).single()
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável. Crie uma nova versão.' }, { status: 409 })
  }
  try {
    const applied = await syncDraftEditorialSnapshot(supabase, draft)
    if (applied) draft.applied_editorial_snapshot = applied
    return NextResponse.json(await refreshDraftEvidence(supabase, draft))
  } catch (refreshError) {
    return NextResponse.json(
      { error: refreshError instanceof Error ? refreshError.message : 'Falha ao atualizar a base.' },
      { status: 500 }
    )
  }
}
