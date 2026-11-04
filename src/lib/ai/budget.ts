import type Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/server'

// Teto de gasto da Anthropic. As rotas são públicas (sem login) e várias gastam
// token por requisição: sem teto, um clique repetido ou um robô vira fatura.
// O teto do console da Anthropic é a última barreira; este é o primeiro e o
// único que o operador vê na tela (parqueia com motivo, não pula em silêncio).

const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  // Tabela da Anthropic consultada em 04/11/2026 (USD por milhão de tokens).
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-fable-5-1': { input: 10, output: 50 },
}
// Modelo desconhecido cai no mais caro: superestimar é o lado seguro de um teto.
const FALLBACK_PRICE = PRICE_PER_MTOK['claude-fable-5-1']

function priceFor(model: string) {
  const key = Object.keys(PRICE_PER_MTOK)
    .sort((a, b) => b.length - a.length)
    .find((name) => model.startsWith(name))
  return key ? PRICE_PER_MTOK[key] : FALLBACK_PRICE
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model)
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}

export class AiBudgetExceededError extends Error {
  readonly code = 'budget_exceeded'
  constructor(message: string) {
    super(message)
    this.name = 'AiBudgetExceededError'
  }
}

function envNumber(name: string): number | null {
  const raw = process.env[name]
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

export interface AiBudgetStatus {
  monthlyLimitUsd: number | null
  monthlySpentUsd: number
  dailyCallLimit: number | null
  dailyCalls: number
}

export async function getAiBudgetStatus(now = new Date()): Promise<AiBudgetStatus> {
  const supabase = createAdminClient()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const { data, error } = await supabase
    .from('ai_usage_ledger')
    .select('created_at, cost_usd')
    .gte('created_at', monthStart)
    .limit(10000)
  // Sem a tabela (051 não aplicada) não há como medir: falha visível, nunca
  // "gasto zero", que liberaria chamadas sem teto.
  if (error) throw new AiBudgetExceededError(`Não foi possível ler o consumo da IA (${error.code}). Aplique a migration 051.`)
  const rows = (data || []) as Array<{ created_at: string; cost_usd: number | string }>
  return {
    monthlyLimitUsd: envNumber('ANTHROPIC_MONTHLY_BUDGET_USD'),
    monthlySpentUsd: rows.reduce((sum, row) => sum + Number(row.cost_usd || 0), 0),
    dailyCallLimit: envNumber('ANTHROPIC_DAILY_CALL_LIMIT'),
    dailyCalls: rows.filter((row) => row.created_at >= dayStart).length,
  }
}

// Chamar ANTES de cada messages.create. Sem teto configurado, a IA não roda:
// ligar a chave sem limite é exatamente o que este módulo existe para impedir.
export async function assertAiBudget(): Promise<void> {
  const status = await getAiBudgetStatus()
  if (status.monthlyLimitUsd == null || status.dailyCallLimit == null) {
    throw new AiBudgetExceededError(
      'Configure ANTHROPIC_MONTHLY_BUDGET_USD e ANTHROPIC_DAILY_CALL_LIMIT antes de usar a IA.'
    )
  }
  if (status.monthlySpentUsd >= status.monthlyLimitUsd) {
    throw new AiBudgetExceededError(
      `Teto mensal da IA atingido: US$ ${status.monthlySpentUsd.toFixed(2)} de US$ ${status.monthlyLimitUsd.toFixed(2)}.`
    )
  }
  if (status.dailyCalls >= status.dailyCallLimit) {
    throw new AiBudgetExceededError(`Limite diário de chamadas à IA atingido: ${status.dailyCalls} de ${status.dailyCallLimit}.`)
  }
}

export async function recordAiUsage(
  purpose: string,
  model: string,
  usage: { input_tokens?: number | null; output_tokens?: number | null } | null | undefined
): Promise<void> {
  const inputTokens = usage?.input_tokens || 0
  const outputTokens = usage?.output_tokens || 0
  const supabase = createAdminClient()
  const { error } = await supabase.from('ai_usage_ledger').insert({
    purpose,
    model,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: estimateCostUsd(model, inputTokens, outputTokens),
  })
  // O gasto já aconteceu; falhar aqui perderia o texto pago. Registra o erro
  // em log para o operador e segue — o próximo assertAiBudget falha se a
  // tabela sumiu.
  if (error) console.error('[ai-budget] falha ao registrar consumo', error.code)
}

// Envolve messages.create: confere o teto antes, registra o consumo depois.
export async function withAiBudget(
  purpose: string,
  create: (params: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  await assertAiBudget()
  const result = await create(params)
  await recordAiUsage(purpose, params.model, result.usage)
  return result
}
