import { describe, expect, it } from 'vitest'
import { buildDesignPrompt } from './design-prompt'

describe('prompt de diagramação', () => {
  it('relatório: estrutura completa, marca e regra de não trocar links', () => {
    const prompt = buildDesignPrompt({ clientDisplayName: 'PRIO S.A.', brand: 'VX', periodLabel: 'Outubro de 2026', hasSections: true })
    expect(prompt).toContain('Assinatura: VX')
    expect(prompt).toContain('08 Cenários')
    expect(prompt).toContain('Não troque, não complete e não acrescente')
    expect(prompt).toContain('diagrame o texto como está')
  })

  it('boletim da SindInfor: formato reduzido, sem estratégia', () => {
    const prompt = buildDesignPrompt({ clientDisplayName: 'SindInfor-MG', brand: 'SAUZ', periodLabel: 'Outubro de 2026', format: 'boletim', location: 'Belo Horizonte/MG', hasSections: false })
    expect(prompt).toContain('sem estratégia, sem recomendações e sem cenários')
    expect(prompt).toContain('Local: Belo Horizonte/MG.')
    expect(prompt).toContain('Prompt mestre (redação)')
  })
})
