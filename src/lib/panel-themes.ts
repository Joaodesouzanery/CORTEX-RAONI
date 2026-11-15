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
  image: string | null
  published_at: string | null
  cites_client: boolean
  /** Destaque confirmado por uma pessoa na curadoria. */
  highlighted: boolean
  /** Sem texto integral: a relevância saiu só de título e resumo. */
  weak: boolean
}

export type PanelTheme = { title: string; articles: PanelThemeArticle[] }

export type PanelThemesResult = {
  period: string
  /** Denominador: marcadas para o cliente no mês, sem as excluídas. */
  total_tagged: number
  /** Marcadas que não casaram nenhum tema: ficam visíveis, não somem. */
  unthemed: number
  themes: PanelTheme[]
  /** As marcadas sem tema, para o bloco "Outras do cliente" (14/11/2026). */
  others: PanelThemeArticle[]
}

type ThemeRow = {
  article_id: string
  cita_cliente?: boolean | null
  monitoring_status?: string | null
  report_role_source?: string | null
  articles: {
    title: string
    url?: string | null
    resolved_url?: string | null
    excerpt?: string | null
    content?: string | null
    publisher?: string | null
    image_url?: string | null
    published_at?: string | null
    content_status?: string | null
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
  const toArticle = (row: ThemeRow): PanelThemeArticle => ({
    id: row.article_id,
    title: row.articles.title,
    url: safeExternalUrl(row.articles.resolved_url || row.articles.url),
    publisher: row.articles.publisher ?? null,
    image: safeExternalUrl(row.articles.image_url),
    published_at: row.articles.published_at ?? null,
    cites_client: Boolean(row.cita_cliente),
    highlighted: row.report_role_source === 'humano',
    weak: row.articles.content_status !== 'integral',
  })
  const byRelevance = (a: PanelThemeArticle, b: PanelThemeArticle) =>
    Number(b.highlighted) - Number(a.highlighted) ||
    Number(b.cites_client) - Number(a.cites_client) ||
    String(b.published_at).localeCompare(String(a.published_at))
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
        return toArticle(row)
      })
      .sort(byRelevance)
    return { title: template.title, articles }
  })
  const others = visible.filter((row) => !themed.has(row.article_id)).map(toArticle).sort(byRelevance)
  return { period, total_tagged: visible.length, unthemed: others.length, themes, others }
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
