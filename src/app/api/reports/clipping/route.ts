import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { clippingCreateSchema, formatZodError } from '@/lib/validation'
import { fetchArticleText } from '@/lib/fetcher/extract'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Full-text budget per article (clippings deliver the whole matéria, so this is
// larger than the dossier's summary cap).
const MAX_CHARS = 12000
// Bodies thinner than this are re-fetched from the real page (mostly Google News
// items, which arrive title-only). Cap + concurrency keep the pass under 60s.
const THIN_MIN = 600
const ENRICH_CAP = 40
const ENRICH_CONCURRENCY = 10
const ENRICH_TIMEOUT_MS = 6000

// Strip HTML → paragraphs, preserving block breaks (so the PDF renders real
// paragraphs instead of one wall of text). Collapses horizontal whitespace but
// keeps newlines from block-level tags.
function toParagraphs(raw: string | null | undefined): string[] {
  if (!raw) return []
  let text = raw
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
  text = text
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + '…'
  return text
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
}

const bodyLen = (a: Article) => toParagraphs(a.content).join(' ').length

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : 'N/A'
}

const veiculoOf = (a: { publisher?: string | null; sources?: { name?: string } | null }) =>
  a.publisher || a.sources?.name || 'Desconhecida'

// Assembles a curated clipping: for the SELECTED articles, returns each matéria
// with its full text (enriched on-demand and cached back). Deterministic, no AI —
// the PDF is rendered client-side from this payload.
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = clippingCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { article_ids, client_id, mes } = parsed.data

  const { data: rows, error } = await supabase.from('articles').select('*, sources(name)').in('id', article_ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!rows?.length) return NextResponse.json({ error: 'Nenhuma matéria encontrada.' }, { status: 400 })

  // Preserve the selection order the client sent.
  const byId = new Map((rows as Article[]).map((a) => [a.id, a]))
  const arr = article_ids.map((id) => byId.get(id)).filter(Boolean) as Article[]

  let clientName: string | null = null
  if (client_id) {
    const { data: c } = await supabase.from('clients').select('name').eq('id', client_id).single()
    clientName = (c as { name?: string } | null)?.name || null
  }

  // Enrich thin bodies with the real page text, bounded to the 60s budget.
  const allThin = arr.filter((a) => a.url && bodyLen(a) < THIN_MIN)
  const thin = allThin.slice(0, ENRICH_CAP)
  const enriched = new Map<string, string>()
  for (let i = 0; i < thin.length; i += ENRICH_CONCURRENCY) {
    const batch = thin.slice(i, i + ENRICH_CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (a) => {
        const text = await fetchArticleText(a.url!, ENRICH_TIMEOUT_MS)
        if (text && text.length > bodyLen(a)) enriched.set(a.id, text)
      })
    )
  }
  if (enriched.size) {
    await Promise.allSettled(
      Array.from(enriched).map(([id, content]) => supabase.from('articles').update({ content }).eq('id', id))
    )
  }

  const items = arr.map((a, i) => {
    const paragraphs = toParagraphs(enriched.get(a.id) ?? a.content)
    return {
      n: i + 1,
      title: a.title || '(sem título)',
      veiculo: veiculoOf(a),
      data: fmtDate(a.published_at),
      url: a.url || '',
      paragraphs: paragraphs.length
        ? paragraphs
        : [a.excerpt?.trim() || '(texto completo indisponível — abra o link da matéria)'],
    }
  })

  // Surface any truncation instead of silently dropping (plan: no silent caps).
  const notEnriched = Math.max(0, allThin.length - thin.length)
  return NextResponse.json({
    clientName,
    mes: mes || null,
    items,
    meta: { total: items.length, enriched: enriched.size, notEnriched },
  })
}
