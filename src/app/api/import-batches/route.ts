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
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })
    .limit(50)
  if (params.get('client_id')) query = query.eq('client_id', params.get('client_id')!)
  if (params.get('period')) query = query.eq('period_month', periodMonth(params.get('period')!))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const parsed = importBatchCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('import_batches')
    .insert({
      client_id: parsed.data.client_id,
      period_month: periodMonth(parsed.data.period),
      intent: parsed.data.intent,
      total_files: parsed.data.total_files,
    })
    .select('*, clients(id, name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

