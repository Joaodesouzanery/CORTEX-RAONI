import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { clientCreateSchema, formatZodError } from '@/lib/validation'
import { syncClientThematicSources } from '@/lib/client-sources'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const supabase = createClient()
  let query = supabase.from('clients').select('*').order('name', { ascending: true })
  if (new URL(req.url).searchParams.get('active') === 'true') query = query.eq('active', true)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = clientCreateSchema.safeParse(body)
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
    report_brand_name,
    report_brand_footer,
    report_brand_guidelines,
  } = parsed.data

  const { data, error } = await supabase
    .from('clients')
    .insert({
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
      report_brand_name: report_brand_name || contratante || null,
      report_brand_footer: report_brand_footer || null,
      report_brand_guidelines: report_brand_guidelines || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    await syncClientThematicSources(supabase, data.id, feed_names)
  } catch (syncError) {
    await supabase.from('clients').delete().eq('id', data.id)
    return NextResponse.json({ error: (syncError as Error).message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
