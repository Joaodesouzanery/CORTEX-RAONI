import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { AiBudgetExceededError } from '@/lib/ai/budget'
import { aiClassifierReady, classifyWithMasterPrompt, MASTER_CLASSIFY_BATCH, type MasterClassifyClient } from '@/lib/ai/classify-master'
import { applyDecisions, buildQualificationPackage, importSchema, loadQualificationItems, validateDecisions } from '@/lib/qualification'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Lotes de IA por chamada: cada um leva ~10-20 s; 2 cabem nos 60 s. A tela chama de novo. */
const AI_BATCHES_PER_CALL = 2

async function context(id: string) {
  const supabase = createAdminClient()
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .select('id, client_id, period_month, clients(id, name, sector, report_prompt, client_report_topic_templates(title, active))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!draft) return null
  const client = (Array.isArray(draft.clients) ? draft.clients[0] : draft.clients) as {
    id: string
    name: string
    sector: string | null
    report_prompt: string | null
    client_report_topic_templates: Array<{ title: string; active: boolean }> | null
  }
  const masterClient: MasterClassifyClient = {
    name: client.name,
    sector: client.sector,
    report_prompt: client.report_prompt,
    themes: (client.client_report_topic_templates || []).filter((theme) => theme.active !== false).map((theme) => theme.title),
  }
  return { supabase, draft, client, masterClient, period: String(draft.period_month).slice(0, 7) }
}

// GET: pacote de qualificação (.md) para colar num chat do Claude, sem chave.
// Pública como as demais rotas de relatório (interface sem login): expõe
// título, veículo, data, resumo curto e link das matérias do cliente no mês,
// o mesmo que Notícias já mostra. Só leitura; não gasta token.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const ctx = await context(id)
    if (!ctx) return NextResponse.json({ error: 'Rascunho não encontrado.' }, { status: 404 })
    const items = await loadQualificationItems(ctx.supabase, ctx.client.id, ctx.period)
    const body = buildQualificationPackage(ctx.masterClient, ctx.period, items)
    const slug = `${ctx.client.name}-${ctx.period}`.replace(/[^A-Za-z0-9-]/g, '')
    return new NextResponse(body, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}-qualificacao.md"` },
    })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}

const postSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('ai') }),
  z.object({ mode: z.literal('import'), payload: z.string().min(2).max(2_000_000) }),
])

// POST mode=import: grava o JSON que o chat devolveu (validado: só id do
// pacote e tema da lista; nunca sobrescreve decisão de pessoa). Sem custo.
// POST mode=ai: roda o prompt mestre no que a regra marcou. Custa tokens da
// Anthropic dentro do teto (assertAiBudget); sem chave responde 503. Rota
// pública como as demais que usam IA neste app — o teto é a barreira.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Envie {"mode":"ai"} ou {"mode":"import","payload":"<json>"}.' }, { status: 400 })
  try {
    const ctx = await context(id)
    if (!ctx) return NextResponse.json({ error: 'Rascunho não encontrado.' }, { status: 404 })
    const items = await loadQualificationItems(ctx.supabase, ctx.client.id, ctx.period)

    if (parsed.data.mode === 'import') {
      // Aceita o JSON puro ou com cerca de código (```json ... ```).
      const raw = parsed.data.payload.replace(/^[\s\S]*?```(?:json)?\s*/i, '').replace(/```[\s\S]*$/, '').trim() || parsed.data.payload
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch {
        return NextResponse.json({ error: 'O texto colado não é um JSON válido.' }, { status: 400 })
      }
      const decoded = importSchema.safeParse(json)
      if (!decoded.success) return NextResponse.json({ error: 'JSON fora do formato {"decisoes":[...]}.' }, { status: 400 })
      const valid = validateDecisions(decoded.data.decisoes, items, ctx.masterClient.themes)
      const updated = await applyDecisions(ctx.supabase, ctx.client.id, valid)
      return NextResponse.json({ received: decoded.data.decisoes.length, valid: valid.length, updated, ignored: decoded.data.decisoes.length - valid.length })
    }

    const notReady = aiClassifierReady()
    if (notReady) return NextResponse.json({ status: 'nao_configurado', detail: `${notReady} Use o pacote de qualificação enquanto isso.` }, { status: 503 })
    const pending = items.filter((item) => item.source !== 'ia')
    let updated = 0
    let reviewed = 0
    for (let batch = 0; batch < AI_BATCHES_PER_CALL && reviewed < pending.length; batch++) {
      const slice = pending.slice(reviewed, reviewed + MASTER_CLASSIFY_BATCH)
      const decisions = await classifyWithMasterPrompt(ctx.masterClient, slice)
      updated += await applyDecisions(ctx.supabase, ctx.client.id, decisions)
      reviewed += slice.length
    }
    return NextResponse.json({ reviewed, updated, remaining: Math.max(0, pending.length - reviewed) })
  } catch (error) {
    if (error instanceof AiBudgetExceededError) return NextResponse.json({ status: 'teto_atingido', detail: error.message }, { status: 503 })
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
