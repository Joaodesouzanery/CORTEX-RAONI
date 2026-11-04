import { describe, expect, it } from 'vitest'
import { estimateCostUsd } from './budget'

describe('estimateCostUsd', () => {
  it('cobra o preço do modelo pelo nome', () => {
    expect(estimateCostUsd('claude-sonnet-4-6', 1_000_000, 0)).toBe(3)
    expect(estimateCostUsd('claude-sonnet-5-5', 1_000_000, 0)).toBe(2)
    expect(estimateCostUsd('claude-haiku-5-5', 0, 1_000_000)).toBe(0.5)
  })

  it('modelo desconhecido cai no preço mais caro', () => {
    expect(estimateCostUsd('modelo-novo', 1_000_000, 1_000_000)).toBe(60)
  })
})
