import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { sourceCreateSchema, formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: Request) {
  const supabase = createClient()
  // `?client_id=` traz junto o vínculo com aquele cliente, para o filtro de
  // fontes em Notícias poder agrupar "Fontes deste cliente" no topo. O embed
  // NÃO é `!inner`: fontes sem vínculo continuam vindo, com client_sources: [].
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (clientId && !UUID_RE.test(clientId)) {
    return NextResponse.json({ error: 'client_id inválido.' }, { status: 400 })
  }
  let query = supabase
    .from('sources')
    .select(clientId ? '*, client_sources(client_id, priority, is_thematic)' : '*')
    .order('created_at', { ascending: false })
  if (clientId) query = query.eq('client_sources.client_id', clientId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = sourceCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { data, error } = await supabase.from('sources').insert(parsed.data).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
