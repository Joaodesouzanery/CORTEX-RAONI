import type { FetchRun } from '@/types'

/**
 * Quando um run de coleta deixa de ser "em andamento" e passa a ser "travado".
 *
 * A migration 025 cria `fetch_runs_single_active_idx`, um índice único parcial
 * sobre `status IN ('pendente','executando')`: só pode existir UM run ativo no
 * banco inteiro. Não há expiração. Um run que morre no meio — 504 num lote,
 * workflow cancelado, ou a busca por tópico da automação
 * (report-drafts/[id]/topics/[topicId]/search) deixando um run de 1 fonte órfão —
 * bloqueia TODA a coleta de notícias, para sempre, em silêncio.
 *
 * 30 minutos é folgado de propósito: 74 fontes em lotes de 4 são ~19 lotes de
 * até 45 s (o `maxDuration` de /process), ou seja ~15 min no pior caso, e o
 * workflow ainda tem backoff entre lotes que falham.
 */
export const STUCK_RUN_MS = 30 * 60 * 1000

const ACTIVE: FetchRun['status'][] = ['pendente', 'executando']

export function isActiveRun(status: string): boolean {
  return (ACTIVE as string[]).includes(status)
}

/**
 * `started_at` é gravado quando o primeiro lote começa; antes disso só existe
 * `created_at`. Um run criado e nunca processado é exatamente o caso em que o
 * workflow morreu entre o POST e o primeiro /process — e é justamente ele que
 * precisa expirar.
 *
 * Sem nenhum dos dois carimbos, considera TRAVADO. `created_at` é NOT NULL com
 * DEFAULT NOW(), então isso é teórico; mas se um dia acontecer, o custo de
 * encerrar um run vivo é baixo (as fontes voltam para a fila do run seguinte,
 * o pipeline é idempotente) enquanto o custo de não encerrar é o deadlock que
 * esta função existe para impedir.
 */
export function isRunStuck(
  run: Pick<FetchRun, 'status' | 'started_at' | 'created_at'>,
  now: number = Date.now()
): boolean {
  if (!isActiveRun(run.status)) return false
  const reference = run.started_at || run.created_at
  if (!reference) return true
  const timestamp = new Date(reference).getTime()
  if (Number.isNaN(timestamp)) return true
  return now - timestamp >= STUCK_RUN_MS
}
