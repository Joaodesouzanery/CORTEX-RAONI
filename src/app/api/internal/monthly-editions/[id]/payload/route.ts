import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createClient()
  const url = new URL(req.url)
  const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset') || '0') || 0)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50') || 50))
  const { data: edition, error } = await supabase
    .from('monthly_editions')
    .select('*, clients(name, logo_url)')
    .eq('id', id)
    .single()
  if (error || !edition)
    return NextResponse.json({ error: error?.message || 'Edição não encontrada.' }, { status: 404 })
  const { data: items, error: itemsError } = await supabase
    .from('monthly_edition_items')
    .select('*')
    .eq('edition_id', id)
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  const rows = items || []
  return NextResponse.json({
    ...edition,
    items: rows,
    page: {
      offset,
      nextOffset: offset + rows.length,
      done: rows.length < limit,
    },
  })
}
