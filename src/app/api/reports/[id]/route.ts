import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data, error } = await supabase.from('reports').select('*').eq('id', params.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })
  const { prompt, metadata, client_id } = body

  const { data, error } = await supabase
    .from('reports')
    .update({ prompt, metadata: metadata || null, client_id: client_id || null })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { error } = await supabase.from('reports').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
