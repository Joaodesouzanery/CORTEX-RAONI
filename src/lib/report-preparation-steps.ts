/**
 * Por que cada ação da Preparação está bloqueada.
 *
 * A tela tem ~30 botões num plano só e a ÚNICA pista de ordem é o `disabled`.
 * Botão apagado sem motivo é indistinguível de botão quebrado — foi assim que
 * "Relatórios" pareceu vazio quando na verdade estava em erro. Aqui a razão é
 * calculada uma vez, em módulo puro e testável, e vira `title` + texto na tela.
 *
 * A ordem codificada abaixo é a real do pipeline, não uma sugestão:
 * base → triagem → verificação → portões → matéria principal → seções → finalizar.
 */

export interface PreparationState {
  /** Total de candidatas na base do rascunho. */
  total: number
  triaged: number
  hasLead: boolean
  /** `quality_status` do rascunho — o portão que destrava a geração. */
  qualityStatus: string | null
  approved: boolean
  /** Checklist final já sem bloqueios (o item `package` não conta). */
  checklistReady: boolean
  busy: boolean
}

export type PreparationAction = 'verify' | 'generate' | 'finalize' | 'package'

const BUSY = 'Aguarde a ação em andamento terminar.'

export function blockedReason(action: PreparationAction, state: PreparationState): string | null {
  if (state.busy) return BUSY
  const pending = state.total - state.triaged

  if (action === 'verify') {
    if (!state.total) return 'A base está vazia. Clique em "Atualizar base" primeiro.'
    if (pending > 0) return `Faltam ${pending} de ${state.total} candidatas para triar. A verificação roda sobre o universo já triado.`
    return null
  }

  if (action === 'generate') {
    if (!state.hasLead) return 'Escolha a matéria principal em "Base e matéria principal" antes de gerar.'
    if (state.qualityStatus !== 'passed') {
      return 'Rode "Executar portões" e resolva os bloqueios. A geração só abre com os portões aprovados.'
    }
    return null
  }

  if (action === 'finalize') {
    if (state.approved) return 'Esta versão já foi aprovada. Atualize a base para abrir uma nova.'
    if (state.qualityStatus !== 'passed') return 'Os portões de qualidade precisam estar aprovados.'
    return null
  }

  // package
  if (!state.checklistReady) return 'O checklist final ainda tem pendências.'
  return null
}
