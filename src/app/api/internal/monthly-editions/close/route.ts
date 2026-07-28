import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { editionCloseSchema, formatZodError } from '@/lib/validation'
import { createEditionForClient, type ClientWithSources } from '@/lib/monthly-editions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = editionCloseSchema.safeParse({ ...body, dispatch: false })
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  let query = supabase
    .from('clients')
    .select('*, client_sources(source_id, priority, is_thematic)')
    .eq('active', true)
    .order('name', { ascending: true })
  if (parsed.data.client_ids?.length) query = query.in('id', parsed.data.client_ids)
  const { data: clients, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const editions = []
  const alreadyCompleted = []
  const errors = []
  for (const client of (clients as unknown as ClientWithSources[]) || []) {
    try {
      const edition = await createEditionForClient(supabase, client, parsed.data.period, true)
      if (edition.status === 'concluido') alreadyCompleted.push(edition)
      else editions.push(edition)
    } catch (e) {
      errors.push({ client: client.name, error: e instanceof Error ? e.message : 'Falha ao criar edição.' })
    }
  }
  return NextResponse.json({ editions, already_completed: alreadyCompleted, errors })
}
