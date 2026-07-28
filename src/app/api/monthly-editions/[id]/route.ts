import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data, error } = await supabase
    .from('monthly_editions')
    .select('*, clients(name, logo_url), monthly_edition_items(*)')
    .eq('id', id)
    .order('position', { referencedTable: 'monthly_edition_items', ascending: true })
    .single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Edição não encontrada.' }, { status: 404 })
  return NextResponse.json({ ...data, items: data.monthly_edition_items || [] })
}
