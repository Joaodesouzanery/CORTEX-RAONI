import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/report-drafts'
import { computePanorama, type PanoramaRow } from '@/lib/panorama'
import type { NewsQualificationSummary, SourceCategoria } from '@/types'

export const dynamic = 'force-dynamic'

type SummaryRow = {
  report_role: string | null
  triaged_at: string | null
  verification_status: string | null
  editorial_review_state: string | null
  editorial_confidence: number | null
  report_role_source: string | null
  qa_checked_at: string | null
  monitoring_status: string
  tom: PanoramaRow['tom']
  relevancia: PanoramaRow['relevancia']
  cita_cliente: boolean | null
  articles: {
    sources?: { categoria?: SourceCategoria } | Array<{ categoria?: SourceCategoria }> | null
  } | null
}

export async function GET(req: Request) {
  const supabase = createClient()
  const params = new URL(req.url).searchParams
  const clientId = params.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório.' }, { status: 400 })
  const sourceId = params.get('source_id')
  const status = params.get('status')
  const origin = params.get('origin')
  const manualOnly = origin === 'manual'
  if (origin && !manualOnly) return NextResponse.json({ error: 'Origem inválida.' }, { status: 400 })
  const days = Number.parseInt(params.get('days') || '')
  const after =
    params.get('published_after') ||
    (Number.isFinite(days) && days > 0 ? new Date(Date.now() - days * 86400000).toISOString() : null)
  const before = params.get('published_before')
  const articleJoin = sourceId
    ? 'articles!inner(published_at, sources(categoria), article_provenance!inner(source_id))'
    : 'articles!inner(published_at, sources(categoria))'
  try {
    const rows = await fetchAll<SummaryRow>((from, to) => {
      let query = supabase
        .from('article_client_tags')
        .select(
          `report_role, report_role_source, triaged_at, verification_status, editorial_review_state, editorial_confidence, qa_checked_at, monitoring_status, tom, relevancia, cita_cliente, ${articleJoin}`
        )
        .eq('client_id', clientId)
        .neq('monitoring_status', 'excluido')
        .range(from, to)
      if (after) query = query.gte('articles.published_at', after)
      if (before) query = query.lte('articles.published_at', before)
      if (sourceId) query = query.eq('articles.article_provenance.source_id', sourceId)
      if (status && ['candidato', 'confirmado', 'revisao'].includes(status)) {
        query = query.eq('monitoring_status', status)
      }
      if (manualOnly) query = query.eq('manual_intake', true)
      return query as unknown as PromiseLike<{
        data: SummaryRow[] | null
        error: { message: string } | null
      }>
    })
    const panoramaRows = rows.map((row): PanoramaRow => {
      const article = Array.isArray(row.articles) ? row.articles[0] : row.articles
      const source = Array.isArray(article?.sources) ? article.sources[0] : article?.sources
      return {
        tom: row.tom,
        relevancia: row.relevancia,
        cita_cliente: row.cita_cliente,
        categoria: source?.categoria || 'imprensa',
      }
    })
    const response: NewsQualificationSummary = {
      total: rows.length,
      panorama: computePanorama(panoramaRows),
      funnel: {
        detected: rows.length,
        triaged: rows.filter(
          (row) => Boolean(row.triaged_at) || row.report_role_source === 'humano'
        ).length,
        verified: rows.filter(
          (row) =>
            row.editorial_review_state === 'revisado' ||
            (row.verification_status === 'verificada' && Boolean(row.qa_checked_at))
        ).length,
        qualified: rows.filter(
          (row) =>
            row.report_role === 'evidencia' &&
            (row.report_role_source === 'humano' ||
              row.editorial_review_state === 'revisado' ||
              (row.verification_status === 'verificada' &&
                Boolean(row.qa_checked_at) &&
                Number(row.editorial_confidence || 0) >= 0.85))
        ).length,
        review: rows.filter(
          (row) => !row.report_role || row.editorial_review_state === 'pendente'
        ).length,
        annex: rows.filter((row) => row.report_role === 'contexto' || row.report_role === 'ruido').length,
        excluded: 0,
      },
    }
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao calcular o panorama.'
    if (manualOnly && (message.includes('manual_intake') || message.includes('manual_received_at'))) {
      return NextResponse.json(
        { error: 'Aplique a migration 029 para usar o filtro “Enviadas por mim”.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
