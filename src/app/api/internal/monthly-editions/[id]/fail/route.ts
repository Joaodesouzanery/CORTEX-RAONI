import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const message = typeof body?.error === 'string' ? body.error.slice(0, 2000) : 'Falha no worker mensal.'
  const supabase = createClient()
  const { error } = await supabase
    .from('monthly_editions')
    .update({ status: 'erro', error: message })
    .eq('id', id)
    .neq('status', 'concluido')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
