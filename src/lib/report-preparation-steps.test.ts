import { describe, expect, it } from 'vitest'
import { blockedReason, type PreparationState } from './report-preparation-steps'

const state = (overrides: Partial<PreparationState> = {}): PreparationState => ({
  total: 100,
  triaged: 100,
  hasLead: true,
  qualityStatus: 'passed',
  approved: false,
  checklistReady: true,
  busy: false,
  ...overrides,
})

describe('blockedReason', () => {
  it('não inventa motivo quando a ação está liberada', () => {
    for (const action of ['verify', 'generate', 'finalize', 'package'] as const) {
      expect(blockedReason(action, state())).toBeNull()
    }
  })

  it('diz quantas faltam para triar, com denominador', () => {
    expect(blockedReason('verify', state({ triaged: 40 }))).toBe(
      'Faltam 60 de 100 candidatas para triar. A verificação roda sobre o universo já triado.'
    )
  })

  it('distingue base vazia de triagem pendente', () => {
    expect(blockedReason('verify', state({ total: 0, triaged: 0 }))).toMatch(/base está vazia/)
  })

  it('aponta a etapa que falta para gerar, na ordem do pipeline', () => {
    expect(blockedReason('generate', state({ hasLead: false }))).toMatch(/matéria principal/)
    // Com lead escolhido, o bloqueio passa a ser o portão — nunca os dois de uma vez.
    expect(blockedReason('generate', state({ qualityStatus: 'blocked' }))).toMatch(/Executar portões/)
  })

  it('separa "já aprovada" de "portões reprovados" no finalizar', () => {
    expect(blockedReason('finalize', state({ approved: true }))).toMatch(/já foi aprovada/)
    expect(blockedReason('finalize', state({ qualityStatus: null }))).toMatch(/portões de qualidade/)
  })

  it('o ocupado vence qualquer outro motivo', () => {
    expect(blockedReason('generate', state({ busy: true, hasLead: false }))).toMatch(/Aguarde/)
  })
})
