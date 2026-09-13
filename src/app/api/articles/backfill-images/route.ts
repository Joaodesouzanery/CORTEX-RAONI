import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchOgImage } from '@/lib/fetcher/rss'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Fill images for articles that have none — including Google News items, whose
// redirect links are resolved to the real outlet page (skipped in the main fetch
// for speed). Decoupled from /api/articles/fetch so the news fetch stays fast;
// this runs on its own and fills images over successive runs.
const BATCH = 8
// Menor que os 48 anteriores: resolver o link do Google News custa 1-2
// requisições extras por item, dentro do mesmo maxDuration de 60s. O workflow
// chama esta rota 3x por ciclo, então a vazão por ciclo se mantém.
const LIMIT = 24
// Um link que nunca resolve não pode consumir uma vaga do lote para sempre.
const MAX_ATTEMPTS = 3

async function run() {
  const supabase = createClient()
  const { data: articles, error: selectError } = await supabase
    .from('articles')
    .select('id, url, resolved_url, image_attempts')
    .is('image_url', null)
    .not('url', 'is', null)
    .lt('image_attempts', MAX_ATTEMPTS)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(LIMIT)
  if (selectError) return NextResponse.json({ error: selectError.message }, { status: 500 })

  if (!articles?.length) return NextResponse.json({ updated: 0, remaining: 0 })

  let updated = 0
  let generic = 0
  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH)
    await Promise.allSettled(
      batch.map(async (a) => {
        // Marca a tentativa ANTES de buscar, como /api/articles/enrich já faz.
        // É isto que impede um link irresolúvel de voltar ao topo da fila em
        // toda execução e bloquear os artigos mais antigos.
        await supabase
          .from('articles')
          .update({
            image_attempts: (a.image_attempts ?? 0) + 1,
            image_attempted_at: new Date().toISOString(),
          })
          .eq('id', a.id)

        // Reaproveita a URL já resolvida, se houver: evita repetir a ida ao
        // endpoint batchexecute do Google.
        const { image, resolvedUrl } = await fetchOgImage(a.resolved_url || a.url!)

        const patch: Record<string, unknown> = {}
        if (resolvedUrl && !a.resolved_url) patch.resolved_url = resolvedUrl
        // `fetchOgImage` já descarta imagem genérica e devolve null — null
        // mantém o artigo elegível; uma imagem errada o marcaria como
        // resolvido para sempre.
        if (image) patch.image_url = image
        else generic++

        if (Object.keys(patch).length) {
          const { error } = await supabase.from('articles').update(patch).eq('id', a.id)
          if (!error && patch.image_url) updated++
        }
      })
    )
  }

  const { count } = await supabase
    .from('articles')
    .select('id', { count: 'exact', head: true })
    .is('image_url', null)
    .lt('image_attempts', MAX_ATTEMPTS)

  return NextResponse.json({
    updated,
    processed: articles.length,
    sem_imagem_utilizavel: generic,
    remaining: count ?? null,
  })
}

export async function POST() {
  return run()
}

export async function GET() {
  return run()
}
