import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { AiBudgetExceededError } from '@/lib/ai/budget'
import { aiClassifierReady, classifyWithMasterPrompt, MASTER_CLASSIFY_BATCH } from '@/lib/ai/classify-master'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const bodySchema = z.object({
  client_id: z.string().uuid().optional(),
  /** Janela em dias de matérias a revisar (padrão 3: as das últimas coletas). */
  days: z.number().int().min(1).max(45).default(3),
})

type Row = {
  article_id: string
  client_id: string
  articles: { title: string; excerpt: string | null; publisher: string | null }
}

// Protegida por CRON_SECRET (middleware, /api/internal/*). Chamada pelo passo
// "Classify with master prompt" do fetch-news. Custo: tokens da Anthropic,
// dentro do teto (assertAiBudget); sem chave, responde 503 "não configurado"
// e o workflow segue — a classificação por regra continua valendo.
// Re-run é no-op: só pega etiqueta de regra ainda não revisada
// (classification_source = 'regra'); a gravada aqui vira 'ia'.
export async function POST(req: Request) {
  const notReady = aiClassifierReady()
  if (notReady) return NextResponse.json({ status: 'nao_configurado', detail: notReady }, { status: 503 })
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 })
  const supabase = createAdminClient()
  const since = new Date(Date.now() - parsed.data.days * 86_400_000).toISOString()

  let clientsQuery = supabase
    .from('clients')
    .select('id, name, sector, report_prompt, client_report_topic_templates(title, active)')
    .eq('active', true)
  if (parsed.data.client_id) clientsQuery = clientsQuery.eq('id', parsed.data.client_id)
  const { data: clients, error: clientsError } = await clientsQuery
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

  const outcomes: Array<{ client: string; reviewed: number; updated: number; error?: string }> = []
  for (const client of clients || []) {
    // Um lote por cliente por chamada: cabe nos 60 s; o workflow chama de novo.
    const { data: rows, error } = await supabase
      .from('article_client_tags')
      .select('article_id, client_id, articles!inner(title, excerpt, publisher, fetched_at)')
      .eq('client_id', client.id)
      .eq('classification_source', 'regra')
      .eq('monitoring_status', 'revisao')
      .gte('articles.fetched_at', since)
      .order('article_id')
      .limit(MASTER_CLASSIFY_BATCH)
    if (error) {
      outcomes.push({ client: client.name, reviewed: 0, updated: 0, error: error.message })
      continue
    }
    const batch = ((rows || []) as unknown as Row[]).map((row) => ({
      id: row.article_id,
      title: row.articles.title,
      excerpt: row.articles.excerpt,
      publisher: row.articles.publisher,
    }))
    if (!batch.length) {
      outcomes.push({ client: client.name, reviewed: 0, updated: 0 })
      continue
    }
    const themes = ((client.client_report_topic_templates as Array<{ title: string; active: boolean }>) || [])
      .filter((theme) => theme.active !== false)
      .map((theme) => theme.title)
    try {
      const decisions = await classifyWithMasterPrompt(
        { name: client.name, sector: client.sector, report_prompt: client.report_prompt, themes },
        batch
      )
      let updated = 0
      for (const decision of decisions) {
        const { data: written, error: writeError } = await supabase
          .from('article_client_tags')
          .update({
            classification_source: 'ia',
            // Irrelevante sai da tela sem apagar (excluido é reversível na curadoria).
            monitoring_status: decision.relevante ? (decision.cita_cliente ? 'confirmado' : 'candidato') : 'excluido',
            cita_cliente: decision.cita_cliente,
            tema: decision.tema,
            tom: decision.tom,
            impact_summary: decision.motivo,
            classified_at: new Date().toISOString(),
          })
          .eq('article_id', decision.article_id)
          .eq('client_id', client.id)
          // Nunca sobrescreve o que uma pessoa marcou entre a leitura e a escrita.
          .eq('classification_source', 'regra')
          .select('article_id')
          .maybeSingle()
        if (writeError) throw new Error(writeError.message)
        if (written) updated++
      }
      outcomes.push({ client: client.name, reviewed: batch.length, updated })
    } catch (err) {
      if (err instanceof AiBudgetExceededError) {
        return NextResponse.json({ status: 'teto_atingido', detail: err.message, outcomes }, { status: 503 })
      }
      outcomes.push({ client: client.name, reviewed: batch.length, updated: 0, error: (err as Error).message })
    }
  }
  const failed = outcomes.filter((outcome) => outcome.error).length
  return NextResponse.json({ outcomes, failed }, { status: failed ? 207 : 200 })
}
