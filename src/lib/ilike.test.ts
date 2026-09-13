import { describe, expect, it } from 'vitest'
import { escapeIlikeTerm, ilikePattern } from './ilike'

describe('escapeIlikeTerm', () => {
  it('escapa os curingas do LIKE', () => {
    // Sem isso, "%" sozinho vira varredura da tabela inteira.
    expect(escapeIlikeTerm('100%')).toBe('100\\%')
    expect(escapeIlikeTerm('a_b')).toBe('a\\_b')
    expect(escapeIlikeTerm('c:\\temp')).toBe('c:\\\\temp')
  })

  it('limita o tamanho do termo', () => {
    expect(escapeIlikeTerm('a'.repeat(500))).toHaveLength(120)
  })

  it('não mexe em texto comum', () => {
    expect(escapeIlikeTerm('arrendamento portuário')).toBe('arrendamento portuário')
  })
})

describe('ilikePattern', () => {
  it('devolve null para termo curto demais', () => {
    // Um "%a%" sobre o acervo inteiro é seq scan por um caractere.
    expect(ilikePattern('a')).toBeNull()
    expect(ilikePattern(' ')).toBeNull()
    expect(ilikePattern('')).toBeNull()
    expect(ilikePattern(null)).toBeNull()
    expect(ilikePattern(undefined)).toBeNull()
  })

  it('envolve em % e escapa', () => {
    expect(ilikePattern('antaq')).toBe('%antaq%')
    expect(ilikePattern(' 50% ')).toBe('%50\\%%')
  })
})
