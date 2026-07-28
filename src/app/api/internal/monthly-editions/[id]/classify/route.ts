import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { suggestTagsWithMode } from '@/lib/ai/classify'
import { buildEditionSummary } from '@/lib/monthly-editions'
import { editionSection } from '@/lib/archive'
import type { Article, ArticleTag, MonthlyEditionItem } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const BATCH = 30

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createClient()
  const body = await req.json().catch(() => ({}))
  const offset = Number.isFinite(body?.offset) && body.offset >= 0 ? Math.floor(body.offset) : 0

  const { data: edition, error: editionError } = await supabase
    .from('monthly_editions')
    .select('*, clients(*)')
    .eq('id', id)
    .single()
  if (editionError || !edition) {
    return NextResponse.json({ error: editionError?.message || 'Edição não encontrada.' }, { status: 404 })
  }
  if (edition.status === 'concluido') {
    return NextResponse.json(
      { error: 'Edição concluída é imutável; crie uma nova versão para regenerar.' },
      { status: 409 }
    )
  }
  await supabase.from('monthly_editions').update({ status: 'classificando', error: null }).eq('id', id)

  const { data: batchRows, error: itemsError } = await supabase
    .from('monthly_edition_items')
    .select('*')
    .eq('edition_id', id)
    .order('position', { ascending: true })
    .range(offset, offset + BATCH - 1)
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 })
  const items = (batchRows as MonthlyEditionItem[]) || []
  let source: 'ia' | 'regra' = 'regra'

  if (items.length) {
    const articles: Article[] = items.map((item) => ({
      ...item.article_snapshot,
      source_id: '',
      fetched_at: edition.created_at,
      excerpt:
        [item.article_snapshot.excerpt, item.article_snapshot.content?.slice(0, 1400)].filter(Boolean).join(' ') ||
        null,
      sources: {
        name: item.article_snapshot.source_name || 'Desconhecida',
        categoria: item.article_snapshot.source_categoria,
      },
    }))
    const classificationResult = await suggestTagsWithMode(articles, edition.clients)
    const suggestions = classificationResult.suggestions
    source = classificationResult.mode
    const byId = new Map(suggestions.map((s) => [s.article_id, s]))
    for (const item of items) {
      const suggestion = byId.get(item.article_id)
      if (!suggestion) continue
      const previous = item.classification_snapshot
      const classification = {
        tom: suggestion.tom ?? previous.tom ?? 'neutro',
        relevancia: suggestion.relevancia ?? previous.relevancia ?? 'baixa',
        cita_cliente: previous.cita_cliente === true || suggestion.cita_cliente === true,
        tema: suggestion.tema ?? previous.tema ?? null,
        confidence: source === 'ia' ? (suggestion.confidence ?? 0.85) : (previous.confidence ?? 0.6),
        impact_summary:
          suggestion.impact_summary ||
          previous.impact_summary ||
          (suggestion.cita_cliente
            ? `A publicação cita ${edition.clients.name} diretamente.`
            : `Pauta do setor com impacto potencial para ${edition.clients.name}.`),
      }
      const tag: ArticleTag = {
        article_id: item.article_id,
        client_id: edition.client_id,
        ...classification,
        classification_source: source,
      }
      const { error: tagError } = await supabase
        .from('article_client_tags')
        .upsert({ ...tag, updated_at: new Date().toISOString() }, { onConflict: 'article_id,client_id' })
      if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 })
      const { error: itemError } = await supabase
        .from('monthly_edition_items')
        .update({ classification_snapshot: classification, section: editionSection(tag) })
        .eq('id', item.id)
      if (itemError) return NextResponse.json({ error: itemError.message }, { status: 500 })
    }
    if (source === 'regra') {
      await supabase
        .from('monthly_editions')
        .update({ summary_data: { ...(edition.summary_data || {}), aiUnavailable: true } })
        .eq('id', id)
    }
  }

  const nextOffset = offset + items.length
  const done = items.length < BATCH
  if (done) {
    const { data: allRows, error } = await supabase
      .from('monthly_edition_items')
      .select('*')
      .eq('edition_id', id)
      .order('position', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const periodLabel = new Date(`${edition.period_month}T12:00:00Z`).toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    const summary = buildEditionSummary((allRows as MonthlyEditionItem[]) || [], edition.clients.name, periodLabel)
    const aiUnavailable = edition.summary_data?.aiUnavailable === true || (items.length > 0 && source === 'regra')
    const markdown = aiUnavailable
      ? `${summary.markdown}\n\n**Nota:** a síntese por IA esteve indisponível; esta versão foi estruturada por regras locais, sem excluir publicações.`
      : summary.markdown
    await supabase
      .from('monthly_editions')
      .update({
        status: 'renderizando',
        summary_markdown: markdown,
        summary_data: {
          ...summary.data,
          classificationMode: aiUnavailable ? 'regra' : 'ia',
          aiUnavailable,
        },
      })
      .eq('id', id)
  }
  return NextResponse.json({ processed: items.length, nextOffset, done, mode: source })
}
