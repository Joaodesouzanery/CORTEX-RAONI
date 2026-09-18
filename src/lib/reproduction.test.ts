import { describe, expect, it } from 'vitest'
import { canReproduceIntegra, normalizeAccessMode, strictestAccessMode } from './reproduction'

describe('access_mode como trava de reprodução', () => {
  it('permite íntegra em público e licenciado, nega em referência', () => {
    expect(canReproduceIntegra('publico')).toBe(true)
    expect(canReproduceIntegra('licenciado')).toBe(true)
    expect(canReproduceIntegra('referencia')).toBe(false)
  })

  it('nega por precaução quando o modo é desconhecido, nulo ou vazio', () => {
    // O custo de errar para o lado permissivo é jurídico e recai sobre um PDF
    // já entregue ao cliente. Não existe default otimista aceitável aqui.
    for (const value of [null, undefined, '', 'publico ', 'PUBLICO', 'qualquer']) {
      expect(canReproduceIntegra(value), `${String(value)} deveria negar`).toBe(false)
      expect(normalizeAccessMode(value)).toBe('referencia')
    }
  })

  it('escolhe o modo mais restritivo entre as fontes do artigo', () => {
    expect(strictestAccessMode(['publico', 'licenciado'])).toBe('licenciado')
    expect(strictestAccessMode(['publico', 'referencia', 'licenciado'])).toBe('referencia')
    expect(strictestAccessMode(['publico', 'publico'])).toBe('publico')
  })

  it('lista vazia é referência, não público', () => {
    expect(strictestAccessMode([])).toBe('referencia')
  })
})
