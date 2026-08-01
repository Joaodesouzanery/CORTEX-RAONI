import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (body?.status !== 'acknowledged') return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  const now = new Date().toISOString()
  const { data, error } = await createClient()
    .from('operational_alerts')
    .update({ status: 'acknowledged', acknowledged_at: now, updated_at: now })
    .eq('id', id)
    .neq('status', 'resolved')
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
