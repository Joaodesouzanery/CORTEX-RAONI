import { describe, expect, it } from 'vitest'
import { saoPauloPeriodOf } from './sao-paulo-period'

describe('saoPauloPeriodOf', () => {
  it('mantém em setembro a matéria de 30/09 às 23h BRT (já outubro em UTC)', () => {
    expect(saoPauloPeriodOf('2026-10-01T02:00:00Z')).toBe('2026-09')
  })
  it('vira o mês à meia-noite de São Paulo', () => {
    expect(saoPauloPeriodOf('2026-10-01T03:00:00Z')).toBe('2026-10')
  })
})
