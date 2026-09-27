import { describe, expect, it } from 'vitest'
import { STUCK_RUN_MS, isActiveRun, isRunStuck } from './fetch-run-recovery'
import type { FetchRun } from '@/types'

const NOW = new Date('2026-09-26T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const run = (overrides: Partial<FetchRun> = {}): Pick<FetchRun, 'status' | 'started_at' | 'created_at'> => ({
  status: 'executando',
  started_at: ago(60_000),
  created_at: ago(60_000),
  ...overrides,
})

describe('isRunStuck', () => {
  it('não mexe em run terminal — encerrado é encerrado', () => {
    for (const status of ['concluido', 'parcial', 'erro'] as const) {
      expect(isRunStuck(run({ status, started_at: ago(10 * 24 * 3600_000) }), NOW)).toBe(false)
    }
  })

  it('deixa em paz um run que começou agora', () => {
    expect(isRunStuck(run({ started_at: ago(5 * 60_000) }), NOW)).toBe(false)
  })

  it('expira o run ativo que passou do limite', () => {
    expect(isRunStuck(run({ started_at: ago(STUCK_RUN_MS + 1000) }), NOW)).toBe(true)
    // O caso real: cinco dias parado bloqueando o índice único.
    expect(isRunStuck(run({ started_at: ago(5 * 24 * 3600_000) }), NOW)).toBe(true)
  })

  it('usa created_at quando o run nunca chegou a começar', () => {
    // Workflow morreu entre o POST /api/fetch-runs e o primeiro /process:
    // started_at fica nulo e só created_at data o run.
    expect(isRunStuck(run({ status: 'pendente', started_at: null, created_at: ago(STUCK_RUN_MS + 1) }), NOW)).toBe(true)
    expect(isRunStuck(run({ status: 'pendente', started_at: null, created_at: ago(60_000) }), NOW)).toBe(false)
  })

  it('sem carimbo utilizável, considera travado — nunca deadlock', () => {
    // O custo de encerrar um run vivo é baixo (o pipeline é idempotente); o de
    // não encerrar é bloquear a coleta inteira para sempre.
    expect(isRunStuck({ status: 'executando', started_at: null, created_at: null as unknown as string }, NOW)).toBe(true)
    expect(isRunStuck({ status: 'executando', started_at: 'não é data', created_at: 'nem isto' }, NOW)).toBe(true)
  })

  it('exatamente no limite já conta como travado', () => {
    expect(isRunStuck(run({ started_at: ago(STUCK_RUN_MS) }), NOW)).toBe(true)
  })
})

describe('isActiveRun', () => {
  it('só pendente e executando ocupam o índice único', () => {
    expect(isActiveRun('pendente')).toBe(true)
    expect(isActiveRun('executando')).toBe(true)
    for (const status of ['concluido', 'parcial', 'erro', 'qualquer']) {
      expect(isActiveRun(status)).toBe(false)
    }
  })
})
