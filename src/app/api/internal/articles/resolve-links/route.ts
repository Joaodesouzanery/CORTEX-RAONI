import { NextResponse } from 'next/server'
import { resolveGoogleNewsUrl } from '@/lib/fetcher/extract'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** 30 por lote, 5 em paralelo e 5s por link cabem nos 60s da Vercel. */
const LIMIT = 30
const CONCURRENCY = 5
/** Depois disso o link sai da fila, mas continua contado em `failed`. */
const MAX_ATTEMPTS = 3

// Protegida por CRON_SECRET em src/middleware.ts. Sem custo de token.
export async function POST() {
  const supabase = createClient()
  const { data: rows, error } = await supabase
    .from('articles')
    .select('id, url, resolve_attempts')
    .like('url', 'https://news.google.com/%')
    .is('resolved_url', null)
    .lt('resolve_attempts', MAX_ATTEMPTS)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let resolved = 0
  let writeErrors = 0
  for (let index = 0; index < (rows?.length ?? 0); index += CONCURRENCY) {
    await Promise.all(
      (rows ?? []).slice(index, index + CONCURRENCY).map(async (row) => {
        const url = await resolveGoogleNewsUrl(row.url as string).catch(() => null)
        const { error: writeError } = await supabase
          .from('articles')
          .update({ resolved_url: url, resolve_attempts: row.resolve_attempts + 1 })
          .eq('id', row.id)
        if (writeError) writeErrors++
        else if (url) resolved++
      })
    )
  }
  if (writeErrors) return NextResponse.json({ error: `${writeErrors} gravações falharam.` }, { status: 500 })
  return NextResponse.json({ processed: rows?.length ?? 0, resolved, done: (rows?.length ?? 0) < LIMIT })
}
