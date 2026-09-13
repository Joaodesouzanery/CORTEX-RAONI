import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Sem isto a rota rodava no default da plataforma (~10s) e o ramo sem
// client_id — count exato sobre a tabela inteira — estourava com 504 em HTML,
// que o cliente lia como "Falha ao carregar notícias". 29 outras rotas já têm.
export const maxDuration = 60

type JoinedArticle = Record<string, unknown> & {
  article_provenance?: Array<{ sources?: unknown }>
}

type ClientArticleJoin = Record<string, unknown> & {
  articles: JoinedArticle | JoinedArticle[] | null
}

export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const paginated = searchParams.get('paginated') === 'true'
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')
  const sourceId = searchParams.get('source_id')
  const origin = searchParams.get('origin')
  const manualOnly = origin === 'manual'
  const search = searchParams.get('search')
  const includeContent = searchParams.get('include_content') === 'true'
  const directOnly = searchParams.get('direct') === 'true'
  const requestedLimit = parseInt(searchParams.get('limit') || (paginated ? '100' : '500'))
  const limit = paginated ? Math.min(200, Math.max(1, requestedLimit || 100)) : requestedLimit
  const offsetParam = searchParams.get('offset')
  const cursorParam = searchParams.get('cursor')
  const daysParam = searchParams.get('days')
  const publishedAfter = searchParams.get('published_after')
  const publishedBefore = searchParams.get('published_before')

  if (origin && !manualOnly) {
    return NextResponse.json({ error: 'Origem inválida.' }, { status: 400 })
  }
  if (manualOnly && (!paginated || !clientId)) {
    return NextResponse.json(
      { error: 'O filtro “Enviadas por mim” exige paginação e um cliente.' },
      { status: 400 }
    )
  }

  if (paginated) {
    const offset = Math.max(0, Number.parseInt(cursorParam || '0') || 0)
    let cutoff: string | null = publishedAfter
    if (!cutoff && daysParam) {
      const days = Number.parseInt(daysParam)
      if (Number.isFinite(days) && days > 0) cutoff = new Date(Date.now() - days * 86400000).toISOString()
    }

    if (clientId) {
      const provenanceJoin = sourceId
        ? 'article_provenance!inner(source_id, sources(id, name, categoria, is_general))'
        : 'article_provenance(source_id, sources(id, name, categoria, is_general))'
      const articleColumns = `id, source_id, title, url, image_url, excerpt, ${includeContent ? 'content,' : ''} published_at, fetched_at, publisher, sources(name, categoria, is_general), ${provenanceJoin}`
      const baseTagColumns =
        'article_id, client_id, tom, relevancia, cita_cliente, tema, classification_source, confidence, impact_summary, monitoring_status, match_score, match_reasons, rule_version, classified_at, updated_at'
      const strategicColumns =
        ', report_role, editorial_score, editorial_reason, cluster_label, report_role_source, triaged_at, triage_version, central_message, strategic_effect, recommended_action, verification_status, editorial_review_state, qualified_at, qualification_version'
      const qualityColumns =
        ', editorial_confidence, geographic_scope, quality_flags, adjudication_version, qa_source, qa_checked_at, source_verification_status'
      const manualColumns = ', manual_intake, manual_received_at'
      const runQuery = (columns: string, applyManualFilter = manualOnly) => {
        let query = supabase
          .from('article_client_tags')
          .select(`${columns}, articles!inner(${articleColumns})`, { count: 'exact' })
          .eq('client_id', clientId)
          .neq('monitoring_status', 'excluido')
          .order('published_at', { referencedTable: 'articles', ascending: false, nullsFirst: false })
          .range(offset, offset + limit - 1)
        if (status && ['candidato', 'confirmado', 'revisao'].includes(status)) {
          query = query.eq('monitoring_status', status)
        }
        if (applyManualFilter) query = query.eq('manual_intake', true)
        if (directOnly) query = query.eq('cita_cliente', true)
        if (cutoff) query = query.gte('articles.published_at', cutoff)
        if (publishedBefore) query = query.lte('articles.published_at', publishedBefore)
        if (search) query = query.ilike('articles.title', `%${search}%`)
        if (sourceId) query = query.eq('articles.article_provenance.source_id', sourceId)
        return query
      }
      let result = await runQuery(`${baseTagColumns}${strategicColumns}${qualityColumns}${manualColumns}`)
      if (
        result.error?.message.includes('manual_intake') ||
        result.error?.message.includes('manual_received_at')
      ) {
        if (manualOnly) {
          return NextResponse.json(
            { error: 'Aplique a migration 029 para usar o filtro “Enviadas por mim”.' },
            { status: 409 }
          )
        }
        result = await runQuery(`${baseTagColumns}${strategicColumns}${qualityColumns}`, false)
      }
      if (
        result.error?.message.includes('editorial_confidence') ||
        result.error?.message.includes('source_verification_status')
      ) {
        result = await runQuery(`${baseTagColumns}${strategicColumns}`)
      }
      if (result.error?.message.includes('central_message') || result.error?.message.includes('report_role')) {
        // Mantém Notícias disponível durante a curta janela entre deploy e 027.
        result = await runQuery(baseTagColumns)
      }
      const { data, error, count } = result
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      const joinedRows = (data || []) as unknown as ClientArticleJoin[]
      const items = joinedRows.flatMap((row) => {
        const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
        if (!article) return []
        const provenance = Array.isArray(article.article_provenance) ? article.article_provenance : []
        return [
          {
            ...article,
            article_provenance: undefined,
            provenance_sources: provenance.flatMap((item: { sources?: unknown }) =>
              item.sources ? (Array.isArray(item.sources) ? item.sources : [item.sources]) : []
            ),
            tag: {
              article_id: row.article_id,
              client_id: row.client_id,
              tom: row.tom,
              relevancia: row.relevancia,
              cita_cliente: row.cita_cliente,
              tema: row.tema,
              classification_source: row.classification_source,
              confidence: row.confidence,
              impact_summary: row.impact_summary,
              monitoring_status: row.monitoring_status,
              match_score: row.match_score,
              match_reasons: row.match_reasons,
              rule_version: row.rule_version,
              classified_at: row.classified_at,
              report_role: row.report_role,
              editorial_score: row.editorial_score,
              editorial_reason: row.editorial_reason,
              cluster_label: row.cluster_label,
              report_role_source: row.report_role_source,
              triaged_at: row.triaged_at,
              triage_version: row.triage_version,
              central_message: row.central_message,
              strategic_effect: row.strategic_effect,
              recommended_action: row.recommended_action,
              verification_status: row.verification_status,
              editorial_review_state: row.editorial_review_state,
              qualified_at: row.qualified_at,
              qualification_version: row.qualification_version,
              editorial_confidence: row.editorial_confidence,
              source_verification_status: row.source_verification_status,
              manual_intake: row.manual_intake === true,
              manual_received_at: row.manual_received_at,
              geographic_scope: row.geographic_scope,
              quality_flags: row.quality_flags,
              adjudication_version: row.adjudication_version,
              qa_source: row.qa_source,
              qa_checked_at: row.qa_checked_at,
              updated_at: row.updated_at,
            },
          },
        ]
      })
      const total = count || 0
      return NextResponse.json({
        items,
        total,
        next_cursor: offset + items.length < total ? String(offset + items.length) : null,
        coverage: {
          start: cutoff,
          end: publishedBefore || new Date().toISOString(),
          complete: offset + items.length >= total,
        },
      })
    }

    const provenanceJoin = sourceId
      ? 'article_provenance!inner(source_id, sources(id, name, categoria, is_general))'
      : 'article_provenance(source_id, sources(id, name, categoria, is_general))'
    // `count: 'estimated'` e não 'exact': sem client_id a contagem exata varre a
    // tabela inteira e é a parte mais cara da requisição. O PostgREST devolve o
    // número exato abaixo de um limiar e a estimativa do planejador acima dele,
    // então o caso pequeno não muda. A contagem exata fica no ramo COM cliente,
    // que é filtrado e é o número que o operador de fato lê no Panorama.
    let query = supabase
      .from('articles')
      .select(
        `id, source_id, title, url, image_url, excerpt, published_at, fetched_at, publisher, sources(name, categoria, is_general), ${provenanceJoin}`,
        { count: 'estimated' }
      )
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1)
    // Sem cliente e sem janela ("Todos" manda período nenhum), a consulta
    // varreria o acervo inteiro. 30 dias é o mesmo padrão que a tela usa.
    if (!cutoff && !publishedBefore) {
      cutoff = new Date(Date.now() - 30 * 86400000).toISOString()
    }
    if (cutoff) query = query.gte('published_at', cutoff)
    if (publishedBefore) query = query.lte('published_at', publishedBefore)
    if (search) query = query.ilike('title', `%${search}%`)
    if (sourceId) query = query.eq('article_provenance.source_id', sourceId)
    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const items = (data || []).map((article) => {
      const provenance = Array.isArray(article.article_provenance) ? article.article_provenance : []
      return {
        ...article,
        article_provenance: undefined,
        provenance_sources: provenance.flatMap((item: { sources?: unknown }) =>
          item.sources ? (Array.isArray(item.sources) ? item.sources : [item.sources]) : []
        ),
      }
    })
    const total = count || 0
    // Paginação derivada do tamanho da página, não do total: com contagem
    // estimada, `offset + items.length < total` erraria. Custa no máximo uma
    // página final vazia; em troca o cursor fica correto sempre.
    const hasMore = items.length === limit
    return NextResponse.json({
      items,
      total,
      total_estimated: true,
      next_cursor: hasMore ? String(offset + items.length) : null,
      coverage: {
        start: cutoff,
        end: publishedBefore || new Date().toISOString(),
        complete: !hasMore,
      },
    })
  }

  // List view never reads `content` (full HTML). Excluding it keeps the payload
  // small — the report flow re-fetches content by id in /api/reports.
  // nullsFirst:false so undated articles (some feeds omit dates) sink to the
  // bottom instead of burying the most recent news under the row limit.
  let query = supabase
    .from('articles')
    .select('id, source_id, title, url, image_url, excerpt, published_at, fetched_at, publisher, sources(name, categoria, is_general)')
    .order('published_at', { ascending: false, nullsFirst: false })

  if (sourceId) query = query.eq('source_id', sourceId)
  if (search) query = query.ilike('title', `%${search}%`)

  // Optional period window: bounds the payload to the selected window so the row
  // limit doesn't bury older-but-in-period news. Undated articles are kept (some
  // feeds omit dates) so the "Todos" view still shows them.
  let cutoff: string | null = null
  if (daysParam) {
    const days = parseInt(daysParam)
    if (Number.isFinite(days) && days > 0) cutoff = new Date(Date.now() - days * 86400000).toISOString()
  } else if (publishedAfter) {
    // `.or()` recebe uma STRING DE FILTRO CRUA — o postgrest-js não escapa
    // nada. Interpolar o parâmetro direto dava um oráculo booleano sobre
    // qualquer coluna, inclusive articles.content:
    //   ?published_after=2099-01-01,content.ilike.*segredo*
    // A defesa não é sanitizar a string, é reconstruí-la: só uma data que o
    // Date consegue parsear passa, e o que vai para o filtro é o ISO gerado
    // pela máquina, que não tem como conter vírgula ou ponto extra.
    const parsedAfter = new Date(publishedAfter)
    if (!Number.isFinite(parsedAfter.getTime())) {
      return NextResponse.json({ error: 'published_after inválido; use uma data ISO.' }, { status: 400 })
    }
    cutoff = parsedAfter.toISOString()
  }
  if (cutoff) {
    // Strip milliseconds: PostgREST .or() parses each branch as field.op.value on
    // dots, so an internal "." (the ".000Z") would corrupt the value.
    const safe = cutoff.replace(/\.\d{3}Z$/, 'Z')
    // safe-filter-ok: `cutoff` é sempre um ISO gerado por toISOString() acima,
    // nunca a string do usuário — não há como conter vírgula ou ponto extra.
    query = query.or(`published_at.gte.${safe},published_at.is.null`)
  }

  // Pagination: PostgREST caps a response at ~1000 rows (db-max-rows), so the
  // clients page through with `offset` (via .range) to load a full period window
  // instead of only the 1000 most-recent rows. Without offset, keep .limit.
  const offset = offsetParam ? parseInt(offsetParam) : NaN
  query = Number.isFinite(offset) && offset >= 0 ? query.range(offset, offset + limit - 1) : query.limit(limit)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return raw (no title-dedup here). Dedup is applied client-side only in the
  // general/portfolio view, so filtering by a specific source shows all of it.
  return NextResponse.json(data)
}
