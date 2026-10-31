import type { SupabaseClient } from '@supabase/supabase-js'
import { topicMatchesArticle } from '@/lib/monthly-agenda'
import { fetchAll, monthlyTaggedArticles } from '@/lib/report-drafts'
import { safeExternalUrl } from '@/lib/url'

export type PanelThemeTemplate = {
  title: string
  inclusion_terms: string[]
  exclusion_terms: string[]
}

export type PanelThemeArticle = {
  id: string
  title: string
  url: string | null
  publisher: string | null
  published_at: string | null
  cites_client: boolean
}

export type PanelTheme = { title: string; articles: PanelThemeArticle[] }

export type PanelThemesResult = {
  period: string
  /** Denominador: marcadas para o cliente no mês, sem as excluídas. */
  total_tagged: number
  /** Marcadas que não casaram nenhum tema: ficam visíveis, não somem. */
  unthemed: number
  themes: PanelTheme[]
}

type ThemeRow = {
  article_id: string
  cita_cliente?: boolean | null
  monitoring_status?: string | null
  articles: {
    title: string
    url?: string | null
    excerpt?: string | null
    content?: string | null
    publisher?: string | null
    published_at?: string | null
  }
}

/**
 * Calculado na leitura, sem draft nem cron: é o que faz o Painel ter conteúdo
 * logo depois de "Buscar Notícias". Uma matéria pode cair em mais de um tema,
 * por isso a soma dos temas não é o total.
 */
export function buildPanelThemes(
  period: string,
  templates: PanelThemeTemplate[],
  rows: ThemeRow[]
): PanelThemesResult {
  const visible = rows.filter((row) => row.monitoring_status !== 'excluido')
  const themed = new Set<string>()
  const themes = templates.map((template) => {
    const articles = visible
      .filter((row) =>
        topicMatchesArticle(template, {
          title: row.articles.title,
          excerpt: row.articles.excerpt ?? null,
          content: row.articles.content ?? null,
        }).matched
      )
      .map((row) => {
        themed.add(row.article_id)
        return {
          id: row.article_id,
          title: row.articles.title,
          url: safeExternalUrl(row.articles.url),
          publisher: row.articles.publisher ?? null,
          published_at: row.articles.published_at ?? null,
          cites_client: Boolean(row.cita_cliente),
        }
      })
      .sort(
        (a, b) =>
          Number(b.cites_client) - Number(a.cites_client) ||
          String(b.published_at).localeCompare(String(a.published_at))
      )
    return { title: template.title, articles }
  })
  return { period, total_tagged: visible.length, unthemed: visible.length - themed.size, themes }
}

export async function loadPanelThemes(supabase: SupabaseClient, clientId: string, period: string) {
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
    monthlyTaggedArticles(supabase, clientId, period),
  ])
  return buildPanelThemes(period, templates, rows as unknown as ThemeRow[])
}
