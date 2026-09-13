import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/ai/claude'
import { reportCreateSchema, formatZodError } from '@/lib/validation'
import type { Article } from '@/types'
import { selectWithOptionalColumns } from '@/lib/pg-columns'

export const dynamic = 'force-dynamic'
// Hobby caps at 60s. The single-shot path below only runs for mock/local; the
// production UI generates section-by-section via /api/reports/section and POSTs
// the assembled `content` here (no AI call, fast save).
export const maxDuration = 60

// O que a lista de Relatórios realmente lê. Nunca inclui `content`, que é
// TEXT NOT NULL e pode ser enorme.
const REQUIRED_COLUMNS = 'id, prompt, article_ids, created_at, client_id, clients(name, logo_url)'
// Tudo que veio em migrations posteriores. Some uma a uma se o banco estiver
// atrás; o fallback anterior tolerava só as três últimas, e qualquer coluna da
// 026 faltando derrubava a rota — que a lista renderizava como "vazio".
const OPTIONAL_COLUMNS = [
  'metadata',
  'draft_id',
  'period_month',
  'version',
  'lead_article_id',
  'brand_snapshot',
  'agenda_snapshot',
  'quality_snapshot',
  'methodology_snapshot',
  'citation_snapshot',
  'narrative_posture',
]

export async function GET() {
  const supabase = createClient()
  const { data, error, dropped } = await selectWithOptionalColumns(
    REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS,
    // `select` é montado em runtime, então o supabase-js não infere a forma da
    // linha e devolve GenericStringError[]. Cast no estilo já usado no repo.
    async (select) =>
      (await supabase.from('reports').select(select).order('created_at', { ascending: false })) as unknown as {
        data: unknown
        error: { message: string } | null
      }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Degradação declarada, não silenciosa: se colunas sumiram, quem consome
  // sabe disso pelo header em vez de receber campos vazios sem explicação.
  const headers = dropped.length ? { 'x-degraded-columns': dropped.join(',') } : undefined
  return NextResponse.json(data, { headers })
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = reportCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { prompt, article_ids, metadata, client_id, content: providedContent } = parsed.data

  // Preferred path: the client already generated the report section-by-section
  // and sends the assembled markdown. Save it directly — no AI call here.
  let content = providedContent
  if (!content) {
    // Fallback single-shot generation (used in mock/local; may exceed Hobby's
    // 60s limit with a real API key — the UI avoids this path in production).
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

    content = await generateReport(articles as Article[], prompt, metadata, client)
  }

  const { data, error } = await supabase
    .from('reports')
    .insert({ prompt, article_ids, content, metadata: metadata || null, client_id: client_id || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
