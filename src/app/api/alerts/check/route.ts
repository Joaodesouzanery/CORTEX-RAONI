import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { parseKeywords, expandTerms, isRelevant, type ParsedKeyword } from '@/lib/relevance'
import { heuristicSuggest, type ClassifyClient } from '@/lib/ai/classify'
import {
  computeAlerts,
  hasAlerts,
  digestSubject,
  renderDigestText,
  renderDigestHtml,
  type AlertArticle,
  type ClientDigest,
} from '@/lib/alerts'
import { sendEmail, emailEnabled } from '@/lib/email'
import type { Article, Client, Tom, Relevancia } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WINDOW_HOURS = 24
const BASELINE_DAYS = 8
const PERIOD_LABEL = `últimas ${WINDOW_HOURS}h`
const PAGE = 1000
const MAX_PAGES = 8 // baseline light-load cap (≈ 8k rows); logs if hit

type LightRow = {
  id: string
  title: string
  excerpt?: string | null
  url?: string
  publisher: string | null
  published_at: string | null
  sources?: { name?: string } | null
}

const veiculoOf = (a: LightRow) => a.publisher || a.sources?.name || 'Desconhecida'
const relevantTo = (a: LightRow, kws: ParsedKeyword[], feeds: string[]) =>
  (kws.length > 0 && isRelevant(kws, { title: a.title, excerpt: a.excerpt })) || feeds.includes(a.sources?.name || '')

async function loadWindow(
  supabase: ReturnType<typeof createClient>,
  sinceISO: string,
  select: string,
  cap = MAX_PAGES
): Promise<LightRow[]> {
  const all: LightRow[] = []
  for (let page = 0; page < cap; page++) {
    const { data, error } = await supabase
      .from('articles')
      .select(select)
      .gte('published_at', sinceISO)
      .order('published_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data as unknown as LightRow[]) || []
    all.push(...rows)
    if (rows.length < PAGE) break
    if (page === cap - 1)
      console.warn(`[alerts] baseline load hit ${cap} pages (${all.length} rows) — may be truncated`)
  }
  return all
}

async function runCheck() {
  const supabase = createClient()
  const now = Date.now()
  const recentSince = new Date(now - WINDOW_HOURS * 3600_000).toISOString()
  const baselineSince = new Date(now - BASELINE_DAYS * 86400_000).toISOString()

  const [{ data: clientsData }, recent, baseline] = await Promise.all([
    supabase.from('clients').select('id, name, keywords, synonyms, feed_names, alert_recipient').eq('active', true),
    loadWindow(supabase, recentSince, 'id, title, excerpt, url, publisher, published_at, sources(name)', 3),
    loadWindow(supabase, baselineSince, 'id, title, publisher, published_at, sources(name)'),
  ])
  const clients = (clientsData as unknown as Client[]) || []

  const digests: ClientDigest[] = []
  for (const client of clients) {
    const kws = parseKeywords(expandTerms(client.keywords, client.synonyms))
    const feeds = client.feed_names || []
    if (!kws.length && !feeds.length) continue

    const recentRel = recent.filter((a) => relevantTo(a, kws, feeds))
    // Baseline = the days BEFORE the recent window, so today's spike doesn't
    // inflate its own baseline (divide by the pre-recent days, not all 8).
    const recentMs = now - WINDOW_HOURS * 3600_000
    const baselineRelCount = baseline.filter(
      (a) => relevantTo(a, kws, feeds) && a.published_at != null && new Date(a.published_at).getTime() < recentMs
    ).length
    const baselineDailyAvg = baselineRelCount / (BASELINE_DAYS - 1)
    if (!recentRel.length) {
      digests.push({ clientName: client.name, alerts: [], recipient: client.alert_recipient ?? null })
      continue
    }

    // tom/relevância: prefer the human's tags; fall back to the heuristic classifier.
    const { data: tagRows } = await supabase
      .from('article_client_tags')
      .select('article_id, tom, relevancia')
      .eq('client_id', client.id)
      .in(
        'article_id',
        recentRel.map((a) => a.id)
      )
    const tags = new Map<string, { tom: Tom | null; relevancia: Relevancia | null }>()
    for (const t of (tagRows as { article_id: string; tom: Tom | null; relevancia: Relevancia | null }[]) || []) {
      tags.set(t.article_id, { tom: t.tom, relevancia: t.relevancia })
    }

    const cc: ClassifyClient = { name: client.name, keywords: client.keywords, synonyms: client.synonyms }
    const items: AlertArticle[] = recentRel.map((a) => {
      const tag = tags.get(a.id)
      const h = tag?.tom != null && tag?.relevancia != null ? null : heuristicSuggest(a as unknown as Article, cc)
      return {
        title: a.title,
        url: a.url || '',
        veiculo: veiculoOf(a),
        published_at: a.published_at,
        tom: tag?.tom ?? h?.tom ?? null,
        relevancia: tag?.relevancia ?? h?.relevancia ?? null,
      }
    })

    digests.push({
      clientName: client.name,
      alerts: computeAlerts(items, baselineDailyAvg),
      recipient: client.alert_recipient ?? null,
    })
  }

  const active = digests.filter((d) => d.alerts.length > 0)
  const summary = {
    period: PERIOD_LABEL,
    clients: clients.length,
    clientsWithAlerts: active.length,
    totalAlerts: active.reduce((n, d) => n + d.alerts.length, 0),
    emailConfigured: emailEnabled(),
    email: null as null | { sent: boolean; skipped?: string; error?: string; id?: string },
    digests: active,
  }

  if (hasAlerts(digests)) {
    const subject = digestSubject(digests, PERIOD_LABEL)
    summary.email = await sendEmail({
      subject,
      html: renderDigestHtml(digests, PERIOD_LABEL),
      text: renderDigestText(digests, PERIOD_LABEL),
    })
  }
  return NextResponse.json(summary)
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // open when no secret configured (dev)
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return runCheck()
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    const body = await req.json().catch(() => ({}))
    if (!body?.manual) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return runCheck()
}
