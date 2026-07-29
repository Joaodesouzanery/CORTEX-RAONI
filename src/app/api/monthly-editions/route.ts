import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { editionCloseSchema, formatZodError } from '@/lib/validation'
import { createEditionForClient, type ClientWithSources } from '@/lib/monthly-editions'
import { dispatchMonthlyWorkflow } from '@/lib/internal-auth'
import type { MonthlyEdition } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const supabase = createClient()
  const period = new URL(req.url).searchParams.get('period')
  let query = supabase
    .from('monthly_editions')
    .select('*, clients(name, logo_url)')
    .order('period_month', { ascending: false })
    .order('version', { ascending: false })
    .limit(200)
  if (period && /^\d{4}-\d{2}$/.test(period)) query = query.eq('period_month', `${period}-01`)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = editionCloseSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { period, client_ids, dispatch } = parsed.data

  let clientsQuery = supabase
    .from('clients')
    .select('*, client_sources(source_id, priority, is_thematic), client_relevance_rules(*)')
    .eq('active', true)
    .order('name', { ascending: true })
  if (client_ids?.length) clientsQuery = clientsQuery.in('id', client_ids)
  const { data: clients, error: clientsError } = await clientsQuery
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })
  if (!clients?.length) return NextResponse.json({ error: 'Nenhum cliente ativo encontrado.' }, { status: 400 })

  const editions: MonthlyEdition[] = []
  const errors: Array<{ client: string; error: string }> = []
  for (const client of clients as unknown as ClientWithSources[]) {
    try {
      editions.push(await createEditionForClient(supabase, client, period))
    } catch (e) {
      errors.push({ client: client.name, error: e instanceof Error ? e.message : 'Falha ao criar edição.' })
    }
  }

  const dispatchResult =
    dispatch && editions.length
      ? await dispatchMonthlyWorkflow({ editionIds: editions.map((e) => e.id), period })
      : { dispatched: false }
  return NextResponse.json({ editions, errors, dispatch: dispatchResult })
}
