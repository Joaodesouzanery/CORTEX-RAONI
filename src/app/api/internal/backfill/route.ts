import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { buildBackfillQueries, runBackfillQuery, type BackfillClient } from '@/lib/backfill'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BACKFILL_SOURCE_URL = 'cortex://backfill-google-news'

const bodySchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  cursor: z.number().int().min(0).default(0),
})

function termsOf(groups: unknown): string[] {
  return Array.isArray(groups) ? groups.flatMap((group) => (Array.isArray(group) ? group.filter((term): term is string => typeof term === 'string') : [])) : []
}

// Protegida por CRON_SECRET (middleware, /api/internal/*). Chamada pelo passo
// "Backfill month" do fetch-news quando o input backfill_period é preenchido.
// Custo: só requisições ao Google News e escrita no banco; nenhum token.
// Uma consulta por chamada; responde next_cursor até done.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Use {"period":"AAAA-MM","cursor":0}.' }, { status: 400 })
  const { period, cursor } = parsed.data
  const supabase = createAdminClient()

  const { data: source, error: sourceError } = await supabase.from('sources').select('id').eq('url', BACKFILL_SOURCE_URL).maybeSingle()
  if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 })
  if (!source) return NextResponse.json({ status: 'nao_configurado', detail: 'Aplique a migration 061 (fonte de backfill).' }, { status: 503 })

  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('id, name, client_relevance_rules(match_type, required_groups, active), client_report_topic_templates(inclusion_terms, active)')
    .eq('active', true)
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

  const prepared: BackfillClient[] = (clients || []).map((client) => {
    const rules = (client.client_relevance_rules as Array<{ match_type: string; required_groups: unknown; active: boolean }>) || []
    const themes = (client.client_report_topic_templates as Array<{ inclusion_terms: unknown; active: boolean }>) || []
    return {
      id: client.id,
      name: client.name,
      // Só o PRIMEIRO grupo das regras diretas: é o que nomeia o cliente.
      directTerms: rules.filter((rule) => rule.active !== false && rule.match_type === 'direta').flatMap((rule) => termsOf(Array.isArray(rule.required_groups) ? [rule.required_groups[0]] : [])),
      themeTerms: themes.filter((theme) => theme.active !== false).flatMap((theme) => (Array.isArray(theme.inclusion_terms) ? (theme.inclusion_terms as string[]) : [])),
    }
  })
  const queries = buildBackfillQueries(prepared, period)
  if (cursor >= queries.length) return NextResponse.json({ done: true, total: queries.length })
  try {
    const result = await runBackfillQuery(supabase, queries[cursor], period, source.id)
    const next = cursor + 1
    return NextResponse.json({ ...result, cursor, total: queries.length, next_cursor: next, done: next >= queries.length })
  } catch (error) {
    // Consulta que falha não trava o mês: devolve erro visível e o cursor seguinte.
    return NextResponse.json({ error: (error as Error).message, cursor, next_cursor: cursor + 1, total: queries.length, done: cursor + 1 >= queries.length }, { status: 502 })
  }
}
