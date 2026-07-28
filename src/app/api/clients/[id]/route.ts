import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { clientUpdateSchema, formatZodError } from '@/lib/validation'
import { syncClientThematicSources } from '@/lib/client-sources'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_: Request, { params }: RouteContext) {
  const { id } = await params
  const supabase = createClient()
  const { data, error } = await supabase.from('clients').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: Request, { params }: RouteContext) {
  const { id } = await params
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = clientUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const {
    name,
    context,
    report_prompt,
    sector,
    contratante,
    keywords,
    synonyms,
    feed_names,
    alert_recipient,
    logo_url,
  } = parsed.data

  const { data, error } = await supabase
    .from('clients')
    .update({
      name: name.trim(),
      context: context || null,
      report_prompt: report_prompt || null,
      sector: sector || null,
      contratante: contratante || null,
      keywords: keywords || null,
      synonyms: synonyms || null,
      feed_names: feed_names || null,
      alert_recipient: alert_recipient || null,
      logo_url: logo_url || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    await syncClientThematicSources(supabase, id, feed_names)
  } catch (syncError) {
    return NextResponse.json({ error: (syncError as Error).message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { id } = await params
  const supabase = createClient()
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
