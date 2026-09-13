import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { extractMainText, fetchArticleDocument } from '@/lib/fetcher/extract'
import { extractFirstImage } from '@/lib/fetcher/rss'
import { pickImageCandidate } from '@/lib/fetcher/article-image'
import { cleanArticleText, inferContentStatus } from '@/lib/archive'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LIMIT = 20
const CONCURRENCY = 5

async function run() {
  const supabase = createClient()
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, url, content, excerpt, enrichment_attempts, image_url, resolved_url')
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
        // Baixa o documento UMA vez e aproveita texto e imagem dele. Antes o
        // HTML era descartado depois do texto, e o backfill de imagens repetia
        // a viagem inteira — inclusive a ida ao batchexecute do Google.
        const doc = await fetchArticleDocument(article.resolved_url || article.url!, 7000)
        if (!doc) return

        const patch: Record<string, unknown> = {}
        if (doc.resolvedUrl && !article.resolved_url) patch.resolved_url = doc.resolvedUrl

        // Imagem de graça: o HTML já está em mãos.
        if (!article.image_url) {
          const { load } = await import('cheerio')
          const $ = load(doc.html)
          const image = pickImageCandidate(
            [
              $('meta[property="og:image"]').attr('content'),
              $('meta[property="og:image:url"]').attr('content'),
              $('meta[name="twitter:image"]').attr('content'),
              $('link[rel="image_src"]').attr('href'),
              $('meta[itemprop="image"]').attr('content'),
              extractFirstImage(doc.html),
            ],
            doc.finalUrl
          )
          if (image) patch.image_url = image
        }

        const extracted = await extractMainText(doc.html)
        const current = cleanArticleText(article.content)
        const next = cleanArticleText(extracted)
        if (next.length > current.length) {
          patch.content = next
          patch.content_status = inferContentStatus(next, article.excerpt)
        }

        if (!Object.keys(patch).length) return
        const { error: updateError } = await supabase.from('articles').update(patch).eq('id', article.id)
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
