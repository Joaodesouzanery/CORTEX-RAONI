import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { articleTagSchema, formatZodError } from '@/lib/validation'
import { fetchAll } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

// GET /api/articles/tag?client_id=…  → every tag for that client.
//
// NÃO é uma tabela pequena: é uma linha por (matéria × cliente) sobre o acervo
// inteiro. A versão anterior fazia um `.select()` sem `.range()`, e o PostgREST
// corta em ~1000 linhas SEM erro — acima disso a UI de curadoria passava a
// mostrar matéria etiquetada como não-etiquetada, em quatro telas. Agora pagina
// com o `fetchAll` que já existe em report-drafts.ts.
//
// A escada de degradação por mensagem de erro abaixo compensa deriva de schema
// (ambientes onde as migrations 027/029 ainda não rodaram). Ela é dívida
// conhecida — não copie o padrão para rotas novas — mas foi preservada aqui.
// Como ela precisa INSPECIONAR o erro para escolher o conjunto de colunas, a
// escolha é feita numa sondagem barata e só depois a listagem pagina.
export async function GET(req: Request) {
  const supabase = createClient()
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório' }, { status: 400 })

  const baseColumns =
    'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, monitoring_status, match_score, match_reasons, rule_version, classified_at, report_role, editorial_score, editorial_reason, cluster_label, report_role_source, triaged_at, triage_version, updated_at'
  const strategicColumns =
    ', central_message, strategic_effect, recommended_action, verification_status, source_verification_status, editorial_review_state, qualified_at, qualification_version, editorial_confidence, geographic_scope, quality_flags, adjudication_version, qa_source, qa_checked_at'
  const manualColumns = ', manual_intake, manual_received_at'

  const MISSING_MANUAL = ['manual_intake', 'manual_received_at']
  const MISSING_STRATEGIC = ['central_message', 'source_verification_status']
  const mentions = (message: string | undefined, columns: string[]) =>
    Boolean(message) && columns.some((column) => message!.includes(column))

  // Sondagem: uma linha só, para descobrir qual conjunto de colunas o banco
  // aceita, sem pagar a listagem inteira em cada tentativa.
  const candidates = [
    `${baseColumns}${strategicColumns}${manualColumns}`,
    `${baseColumns}${strategicColumns}`,
    baseColumns,
  ]
  let columns = ''
  let probeError: string | null = null
  for (const candidate of candidates) {
    const probe = await supabase
      .from('article_client_tags')
      .select(candidate)
      .eq('client_id', clientId)
      .limit(1)
    if (!probe.error) {
      columns = candidate
      probeError = null
      break
    }
    probeError = probe.error.message
    // Só degrada quando o erro é a ausência daquelas colunas. Qualquer outra
    // falha (conexão, permissão) propaga — degradar ali devolveria 200 com
    // forma reduzida e esconderia o problema.
    const isSchemaDrift =
      mentions(probe.error.message, MISSING_MANUAL) || mentions(probe.error.message, MISSING_STRATEGIC)
    if (!isSchemaDrift) break
  }
  if (!columns) {
    return NextResponse.json({ error: probeError || 'Falha ao ler etiquetas.' }, { status: 500 })
  }

  try {
    // `columns` é montado em runtime, então o supabase-js não consegue inferir
    // a forma da linha e devolve GenericStringError[]. Cast explícito, no
    // estilo `as unknown as` já usado no repo (report-drafts.ts, fetch-run.ts).
    const rows = await fetchAll<Record<string, unknown>>(
      (from, to) =>
        supabase
          .from('article_client_tags')
          .select(columns)
          .eq('client_id', clientId)
          .range(from, to) as unknown as PromiseLike<{
          data: Record<string, unknown>[] | null
          error: { message: string } | null
        }>
    )
    return NextResponse.json(rows)
  } catch (listError) {
    const message = listError instanceof Error ? listError.message : 'Falha ao ler etiquetas.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/articles/tag  → upsert one (article, client) reputational reading.
// The body carries only the dimension(s) being changed; unspecified columns keep
// their stored value (partial update on conflict).
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = articleTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const { article_id, client_id, ...patch } = parsed.data
  const row: Record<string, unknown> = { article_id, client_id, updated_at: new Date().toISOString() }
  // Only forward the keys actually present in the request so a partial edit
  // (e.g. just `tom`) never blanks the other dimensions.
  for (const k of [
    'tom',
    'relevancia',
    'cita_cliente',
    'tema',
    'classification_source',
    'confidence',
    'impact_summary',
    'monitoring_status',
    'report_role',
    'editorial_score',
    'editorial_reason',
    'cluster_label',
    'report_role_source',
    'central_message',
    'strategic_effect',
    'recommended_action',
    'verification_status',
    'source_verification_status',
    'editorial_review_state',
    'editorial_confidence',
    'geographic_scope',
    'quality_flags',
  ] as const) {
    if (k in patch) row[k] = patch[k]
  }
  if (!('classification_source' in patch)) row.classification_source = 'humano'
  if (
    [
      'central_message',
      'impact_summary',
      'strategic_effect',
      'recommended_action',
      'verification_status',
      'source_verification_status',
      'editorial_review_state',
    ].some((key) => key in patch)
  ) {
    row.qualified_at = new Date().toISOString()
    row.qualification_version = 1
  }
  if (patch.editorial_review_state === 'revisado') {
    row.qa_source = 'humano'
    row.qa_checked_at = new Date().toISOString()
    row.adjudication_version = 2
  }
  if ('report_role' in patch) {
    row.report_role_source = 'humano'
    row.triaged_at = new Date().toISOString()
    row.triage_version = 1
    row.editorial_review_state = 'revisado'
    row.editorial_confidence = patch.report_role === 'evidencia' ? (patch.editorial_confidence ?? 1) : patch.editorial_confidence
    row.qa_source = 'humano'
    row.qa_checked_at = new Date().toISOString()
    row.adjudication_version = 2
  }

  const columns =
    'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, monitoring_status, match_score, match_reasons, rule_version, classified_at, report_role, editorial_score, editorial_reason, cluster_label, report_role_source, triaged_at, triage_version, central_message, strategic_effect, recommended_action, verification_status, source_verification_status, editorial_review_state, qualified_at, qualification_version, editorial_confidence, geographic_scope, quality_flags, adjudication_version, qa_source, qa_checked_at, updated_at'
  const result = await supabase
    .from('article_client_tags')
    .upsert(row, { onConflict: 'article_id,client_id' })
    .select(`${columns}, manual_intake, manual_received_at`)
    .single()
  if (
    result.error?.message.includes('manual_intake') ||
    result.error?.message.includes('manual_received_at')
  ) {
    const fallback = await supabase
      .from('article_client_tags')
      .upsert(row, { onConflict: 'article_id,client_id' })
      .select(columns)
      .single()
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
    return NextResponse.json(fallback.data)
  }
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json(result.data)
}
