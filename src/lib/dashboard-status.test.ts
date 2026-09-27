import { describe, expect, it } from 'vitest'
import { describeQualification } from './dashboard-status'

describe('describeQualification', () => {
  it('não anota nada quando o número já se explica', () => {
    expect(describeQualification({ total: 1298, triaged_count: 495, qualified_count: 141 })).toEqual({
      text: '',
      actionable: false,
    })
  })

  it('reproduz o SINDINFOR: 26 triadas e 0 qualificadas é etapa faltando, não ausência de matéria', () => {
    expect(describeQualification({ total: 117, triaged_count: 26, qualified_count: 0 })).toEqual({
      text: '26 triadas, aguardando verificação',
      actionable: true,
    })
  })

  it('reproduz PRIO e ANTAQ: candidatas existem, triagem nunca rodou', () => {
    expect(describeQualification({ total: 155, triaged_count: 0, qualified_count: 0 })).toEqual({
      text: '155 candidatas aguardando triagem',
      actionable: true,
    })
  })

  it('separa "nada chegou" de "chegou e parou" — a ação é outra', () => {
    const vazio = describeQualification({ total: 0, triaged_count: 0, qualified_count: 0 })
    expect(vazio.text).toMatch(/nenhuma candidata/)
    // Não é acionável pelo Painel: o conserto é em Fontes/regras, não num botão.
    expect(vazio.actionable).toBe(false)
  })

  it('não trata contagem negativa como trabalho represado', () => {
    expect(describeQualification({ total: -1, triaged_count: -1, qualified_count: 0 }).actionable).toBe(false)
  })
})
