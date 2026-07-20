import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { articleTagSuggestSchema, formatZodError } from '@/lib/validation'
import { suggestTags, aiEnabled, type ClassifyClient } from '@/lib/ai/classify'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/articles/tag/suggest → suggested tags for a client's articles.
// Read-only: it does NOT save. The UI applies via /bulk after review.
// Deterministic by default; uses the Anthropic plug-in only when the key is set.
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = articleTagSuggestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { client_id, article_ids } = parsed.data

  const [{ data: client }, { data: articles }] = await Promise.all([
    supabase.from('clients').select('name, keywords, synonyms').eq('id', client_id).single(),
    supabase.from('articles').select('id, title, excerpt').in('id', article_ids),
  ])
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })
  if (!articles?.length) return NextResponse.json({ error: 'Nenhum artigo encontrado' }, { status: 400 })

  const suggestions = await suggestTags(articles as unknown as Article[], client as ClassifyClient)
  return NextResponse.json({ mode: aiEnabled() ? 'ai' : 'heuristic', suggestions })
}
