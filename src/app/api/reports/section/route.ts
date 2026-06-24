import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { generateReportSection } from '@/lib/ai/claude'
import { reportSectionSchema, formatZodError } from '@/lib/validation'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
// Each call generates one bounded group of sections, finishing under Hobby's 60s.
export const maxDuration = 60

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = reportSectionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { group, prompt, article_ids, metadata, client_id, prior } = parsed.data

  const { data: articles } = await supabase
    .from('articles')
    .select('*, sources(name)')
    .in('id', article_ids)

  if (!articles?.length) return NextResponse.json({ error: 'No articles found' }, { status: 400 })

  let client = null
  if (client_id) {
    const { data: clientData } = await supabase
      .from('clients')
      .select('name, context, report_prompt, sector, contratante')
      .eq('id', client_id)
      .single()
    client = clientData
  }

  try {
    const markdown = await generateReportSection(
      group,
      articles as Article[],
      prompt,
      metadata,
      client,
      prior ?? undefined
    )
    return NextResponse.json({ markdown })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro ao gerar seção'
    console.error(`[reports/section] grupo ${group} falhou: ${message}`)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
