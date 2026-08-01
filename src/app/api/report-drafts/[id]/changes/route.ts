import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: checkpoint }, { data: revisions }] = await Promise.all([
    supabase.from('report_review_checkpoints').select('*').eq('draft_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('report_base_revisions').select('*').eq('draft_id', id).order('to_version'),
  ])
  const rows = (revisions || []).filter((revision) => revision.to_version > Number(checkpoint?.base_version || 0))
  return NextResponse.json({
    checkpoint: checkpoint || null,
    revisions: rows,
    summary: {
      added: rows.flatMap((revision) => revision.added || []),
      removed: rows.flatMap((revision) => revision.removed || []),
      reclassified: rows.flatMap((revision) => revision.reclassified || []),
      content_changed: rows.flatMap((revision) => revision.content_changed || []),
      bucket_changes: rows.flatMap((revision) => revision.bucket_changes || []),
    },
  })
}
