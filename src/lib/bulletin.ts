import type { SupabaseClient } from '@supabase/supabase-js'
import { buildPanelThemes, type PanelThemeTemplate } from '@/lib/panel-themes'
import { fetchAll } from '@/lib/report-drafts'

/** Janela do boletim semanal. */
const BULLETIN_DAYS = 7

export async function loadBulletin(supabase: SupabaseClient, clientId: string, now = new Date()) {
  const end = now.toISOString()
  const start = new Date(now.getTime() - BULLETIN_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const [templates, rows] = await Promise.all([
    fetchAll<PanelThemeTemplate>((from, to) =>
      supabase
        .from('client_report_topic_templates')
        .select('title, inclusion_terms, exclusion_terms')
        .eq('client_id', clientId)
        .eq('active', true)
        .order('position')
        .range(from, to)
    ),
    fetchAll<Parameters<typeof buildPanelThemes>[2][number]>((from, to) =>
      supabase
        .from('article_client_tags')
        .select('article_id, cita_cliente, monitoring_status, report_role_source, articles!inner(title, url, excerpt, content, publisher, published_at)')
        .eq('client_id', clientId)
        .gte('articles.published_at', start)
        .lt('articles.published_at', end)
        .range(from, to) as unknown as PromiseLike<{
        data: Parameters<typeof buildPanelThemes>[2] | null
        error: { message: string } | null
      }>
    ),
  ])
  const themes = buildPanelThemes(end.slice(0, 7), templates, rows)
  const seen = new Map<string, (typeof themes.themes)[number]['articles'][number]>()
  themes.themes.flatMap((theme) => theme.articles).forEach((article) => seen.set(article.id, article))
  const highlights = [...seen.values()]
    .filter((article) => article.highlighted || article.cites_client)
    .sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || String(b.published_at).localeCompare(String(a.published_at)))
  return { start, end, ...themes, highlights }
}
