import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

type JoinedArticle = Record<string, unknown>
type ClientArticleRow = Record<string, unknown> & {
  articles: JoinedArticle | JoinedArticle[] | null
}

// Same filters as GET /api/articles?paginated=true&client_id=..., but returns
// every matching row as a CSV download instead of one paginated page — for
// "export all of this client's filtered/qualified news", not just what's
// currently loaded/selected on screen.
export async function GET(req: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório.' }, { status: 400 })

  const status = searchParams.get('status')
  const sourceId = searchParams.get('source_id')
  const manualOnly = searchParams.get('origin') === 'manual'
  const directOnly = searchParams.get('direct') === 'true'
  const daysParam = searchParams.get('days')
  const publishedAfter = searchParams.get('published_after')
  const publishedBefore = searchParams.get('published_before')

  let cutoff: string | null = publishedAfter
  if (!cutoff && daysParam) {
    const days = Number.parseInt(daysParam)
    if (Number.isFinite(days) && days > 0) cutoff = new Date(Date.now() - days * 86400000).toISOString()
  }

  const { data: client } = await supabase.from('clients').select('name').eq('id', clientId).maybeSingle()

  const provenanceJoin = sourceId
    ? 'article_provenance!inner(source_id)'
    : ''
  const articleColumns = ['id, title, url, published_at, publisher, sources(name)', provenanceJoin]
    .filter(Boolean)
    .join(', ')

  const rows = await fetchAll<ClientArticleRow>((from, to) => {
    let query = supabase
      .from('article_client_tags')
      .select(
        `article_id, tom, relevancia, cita_cliente, tema, monitoring_status, report_role, report_role_source, editorial_score, editorial_reason, verification_status, editorial_review_state, articles!inner(${articleColumns})`
      )
      .eq('client_id', clientId)
      .neq('monitoring_status', 'excluido')
      .order('published_at', { referencedTable: 'articles', ascending: false, nullsFirst: false })
      .range(from, to)
    if (status && ['candidato', 'confirmado', 'revisao'].includes(status)) {
      query = query.eq('monitoring_status', status)
    }
    if (manualOnly) query = query.eq('manual_intake', true)
    if (directOnly) query = query.eq('cita_cliente', true)
    if (cutoff) query = query.gte('articles.published_at', cutoff)
    if (publishedBefore) query = query.lte('articles.published_at', publishedBefore)
    if (sourceId) query = query.eq('articles.article_provenance.source_id', sourceId)
    return query as unknown as PromiseLike<{ data: ClientArticleRow[] | null; error: { message: string } | null }>
  })

  const header = [
    'titulo',
    'veiculo',
    'data_publicacao',
    'url',
    'tema',
    'tom',
    'relevancia',
    'cita_cliente',
    'monitoring_status',
    'report_role',
    'report_role_source',
    'editorial_score',
    'editorial_reason',
    'verification_status',
    'editorial_review_state',
  ]
  const csvRows = rows.map((row) => {
    const article = ((Array.isArray(row.articles) ? row.articles[0] : row.articles) || {}) as JoinedArticle
    const sources = (article as { sources?: { name?: string } | { name?: string }[] }).sources
    const sourceName = Array.isArray(sources) ? sources[0]?.name : sources?.name
    return [
      article.title,
      article.publisher || sourceName,
      article.published_at,
      article.url,
      row.tema,
      row.tom,
      row.relevancia,
      row.cita_cliente,
      row.monitoring_status,
      row.report_role,
      row.report_role_source,
      row.editorial_score,
      row.editorial_reason,
      row.verification_status,
      row.editorial_review_state,
    ]
      .map(csvCell)
      .join(',')
  })
  const csvContent = [header.map(csvCell).join(','), ...csvRows].join('\n')

  const slug = (client?.name || 'noticias')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return new NextResponse(`﻿${csvContent}`, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug || 'noticias'}-noticias.csv"`,
    },
  })
}
