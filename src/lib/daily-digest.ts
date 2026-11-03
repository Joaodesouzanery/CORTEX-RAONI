import type { SupabaseClient } from '@supabase/supabase-js'
import { buildDailyDigest, type Row } from '@/lib/daily-digest-core'
import { fetchAll } from '@/lib/report-drafts'

export { buildDailyDigest, digestText } from '@/lib/daily-digest-core'
export type { DailyDigest, DigestStory } from '@/lib/daily-digest-core'

export async function loadDailyDigest(supabase: SupabaseClient, clientId: string, day: string) {
  const start = new Date(`${day}T00:00:00-03:00`).toISOString()
  const end = new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString()
  const rows = await fetchAll<Row>((from, to) =>
    supabase
      .from('article_client_tags')
      .select('article_id, cita_cliente, monitoring_status, articles!inner(title, url, resolved_url, publisher, published_at)')
      .eq('client_id', clientId)
      .gte('articles.published_at', start)
      .lt('articles.published_at', end)
      .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  )
  return buildDailyDigest(day, rows)
}
