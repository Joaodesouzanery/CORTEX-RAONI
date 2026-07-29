import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchArticleText } from '@/lib/fetcher/extract'
import { cleanArticleText, inferContentStatus } from '@/lib/archive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMIT = 20
const CONCURRENCY = 5

async function run() {
  const supabase = createClient()
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, url, content, excerpt, enrichment_attempts')
    .in('content_status', ['parcial', 'metadados'])
    .not('url', 'is', null)
    .lt('enrichment_attempts', 3)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!articles?.length) return NextResponse.json({ processed: 0, updated: 0 })

  let updated = 0
  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    await Promise.allSettled(
      articles.slice(i, i + CONCURRENCY).map(async (article) => {
        await supabase
          .from('articles')
          .update({
            enrichment_attempts: (article.enrichment_attempts || 0) + 1,
            enrichment_attempted_at: new Date().toISOString(),
          })
          .eq('id', article.id)
        const extracted = await fetchArticleText(article.url!, 7000)
        if (!extracted) return
        const current = cleanArticleText(article.content)
        const next = cleanArticleText(extracted)
        if (next.length <= current.length) return
        const { error: updateError } = await supabase
          .from('articles')
          .update({
            content: next,
            content_status: inferContentStatus(next, article.excerpt),
          })
          .eq('id', article.id)
        if (!updateError) updated++
      })
    )
  }
  return NextResponse.json({ processed: articles.length, updated })
}

export async function GET() {
  return run()
}

export async function POST() {
  return run()
}
