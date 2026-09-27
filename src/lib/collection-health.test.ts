import { describe, expect, it } from 'vitest'
import {
  STALLED_RUN_MS,
  describeCollectionHealth,
  humanizeDuration,
  type CollectionHealthInput,
} from './collection-health'

const NOW = new Date('2026-09-26T12:00:00Z').getTime()
const ago = (ms: number) => new Date(NOW - ms).toISOString()
const HORA = 3600_000
const DIA = 24 * HORA

const health = (overrides: Partial<CollectionHealthInput> = {}): CollectionHealthInput => ({
  active_sources: 74,
  healthy_sources: 74,
  stale_sources: 0,
  failed_sources: 0,
  empty_sources: 0,
  never_fetched_sources: 0,
  last_success_at: ago(2 * HORA),
  latest_run: { status: 'concluido', created_at: ago(2 * HORA), finished_at: ago(2 * HORA) },
  ...overrides,
})

describe('describeCollectionHealth', () => {
  it('reproduz o caso real de setembro/2026: a causa é o ciclo, não as 74 fontes', () => {
    // O banner antigo dizia "0/74 saudáveis, 74 atrasadas" — descreve o sintoma
    // e manda auditar 74 fontes quando o problema é um só, do agendador.
    const verdict = describeCollectionHealth(
      health({
        healthy_sources: 0,
        stale_sources: 74,
        failed_sources: 2,
        empty_sources: 1,
        latest_run: { status: 'parcial', created_at: ago(5 * DIA), finished_at: ago(5 * DIA) },
      }),
      NOW
    )
    expect(verdict.level).toBe('atencao')
    expect(verdict.headline).toBe('A coleta não conclui uma execução há 5 dias.')
    expect(verdict.detail).toMatch(/Fetch news/)
    // Não pode liderar pela consequência.
    expect(verdict.headline).not.toMatch(/74/)
  })

  it('a parada do ciclo vence a falha de fonte na ordem de prioridade', () => {
    const parado = describeCollectionHealth(
      health({ failed_sources: 9, latest_run: { status: 'erro', created_at: ago(3 * DIA), finished_at: ago(3 * DIA) } }),
      NOW
    )
    expect(parado.headline).toMatch(/não conclui uma execução/)
  })

  it('com o ciclo em dia, aponta as fontes que falharam', () => {
    const verdict = describeCollectionHealth(health({ failed_sources: 2, healthy_sources: 72 }), NOW)
    expect(verdict.level).toBe('atencao')
    expect(verdict.headline).toBe('2 de 74 fontes falharam na última coleta.')
  })

  it('run em andamento não conta como parada, por mais antigo que seja o anterior', () => {
    const verdict = describeCollectionHealth(
      health({
        stale_sources: 74,
        healthy_sources: 0,
        latest_run: { status: 'executando', created_at: ago(10 * DIA), finished_at: null },
      }),
      NOW
    )
    expect(verdict.headline).toMatch(/fora da janela de 24 h/)
    expect(verdict.detail).toMatch(/em andamento/)
  })

  it('um ciclo perdido ainda não acusa parada; dois acusam', () => {
    const umCiclo = describeCollectionHealth(
      health({ latest_run: { status: 'concluido', created_at: ago(7 * HORA), finished_at: ago(7 * HORA) } }),
      NOW
    )
    expect(umCiclo.level).toBe('ok')
    const doisCiclos = describeCollectionHealth(
      health({
        latest_run: { status: 'concluido', created_at: ago(STALLED_RUN_MS), finished_at: ago(STALLED_RUN_MS) },
      }),
      NOW
    )
    expect(doisCiclos.headline).toMatch(/não conclui uma execução/)
  })

  it('tudo em dia é verde, e "sem itens" não derruba', () => {
    const verdict = describeCollectionHealth(health({ empty_sources: 1, healthy_sources: 74 }), NOW)
    expect(verdict.level).toBe('ok')
    expect(verdict.headline).toBe('74 de 74 fontes dentro da janela de 24 h.')
    expect(verdict.detail).toMatch(/1 fonte voltou sem itens/)
  })

  it('distingue nunca coletada de atrasada', () => {
    expect(describeCollectionHealth(health({ never_fetched_sources: 3 }), NOW).headline).toMatch(/nunca foram coletadas/)
    expect(describeCollectionHealth(health({ latest_run: null }), NOW).headline).toBe('A coleta nunca foi executada.')
    expect(describeCollectionHealth(health({ active_sources: 0 }), NOW).headline).toMatch(/Nenhuma fonte ativa/)
  })
})

describe('humanizeDuration', () => {
  it('escolhe a unidade sem falsa precisão', () => {
    expect(humanizeDuration(30_000)).toBe('1 minuto')
    expect(humanizeDuration(40 * 60_000)).toBe('40 minutos')
    expect(humanizeDuration(1 * HORA)).toBe('1 hora')
    expect(humanizeDuration(14 * HORA)).toBe('14 horas')
    expect(humanizeDuration(5 * DIA)).toBe('5 dias')
  })

  it('não inventa número para entrada inválida', () => {
    expect(humanizeDuration(Number.POSITIVE_INFINITY)).toBe('tempo desconhecido')
    expect(humanizeDuration(-1)).toBe('tempo desconhecido')
  })
})
