import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, importBatchCreateSchema } from '@/lib/validation'
import { periodMonth } from '@/lib/import/batches'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  const params = new URL(req.url).searchParams
  let query = supabase
    .from('import_batches')
    .select(
      '*, clients!import_batches_client_id_fkey(id, name), import_batch_clients(client_id, clients!import_batch_clients_client_id_fkey(id, name))'
    )
    .order('created_at', { ascending: false })
    .limit(50)
  if (params.get('period')) query = query.eq('period_month', periodMonth(params.get('period')!))
  let result = await query
  if (result.error?.message.includes('import_batch_clients')) {
    let fallback = supabase
      .from('import_batches')
      .select('*, clients!import_batches_client_id_fkey(id, name)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (params.get('period')) fallback = fallback.eq('period_month', periodMonth(params.get('period')!))
    result = await fallback
  }
  const { data, error } = result
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []).map((batch) => {
    const links = Array.isArray(batch.import_batch_clients) ? batch.import_batch_clients : []
    const selectedClients = links.flatMap((link: { client_id: string; clients?: unknown }) => {
      const client = Array.isArray(link.clients) ? link.clients[0] : link.clients
      return client ? [client] : []
    })
    const legacyClient = Array.isArray(batch.clients) ? batch.clients[0] : batch.clients
    return {
      ...batch,
      import_batch_clients: undefined,
      client_ids: links.length
        ? links.map((link: { client_id: string }) => link.client_id)
        : [batch.client_id],
      selected_clients: selectedClients.length ? selectedClients : legacyClient ? [legacyClient] : [],
    }
  })
  const clientId = params.get('client_id')
  return NextResponse.json(clientId ? rows.filter((batch) => batch.client_ids.includes(clientId)) : rows)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const parsed = importBatchCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const primaryClientId = parsed.data.client_ids[0]
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      client_id: primaryClientId,
      period_month: periodMonth(parsed.data.period),
      intent: parsed.data.intent,
      reference_kind:
        parsed.data.intent === 'relatorio_referencia'
          ? parsed.data.reference_kind || 'historical'
          : 'historical',
      total_files: parsed.data.total_files,
    })
    .select('*, clients!import_batches_client_id_fkey(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { error: clientsError } = await supabase.from('import_batch_clients').insert(
    parsed.data.client_ids.map((clientId) => ({
      batch_id: data.id,
      client_id: clientId,
    }))
  )
  if (clientsError) {
    await supabase.from('import_batches').delete().eq('id', data.id)
    return NextResponse.json({ error: clientsError.message }, { status: 500 })
  }
  return NextResponse.json({ ...data, client_ids: parsed.data.client_ids }, { status: 201 })
}
