/**
 * Por que um cliente mostra "0 evidências qualificadas".
 *
 * O número sozinho mente por omissão. Três estados diferentes produzem zero, e
 * cada um pede uma ação distinta do operador:
 *
 * - **Nada chegou.** Sem candidatas, é problema de captação (regras do cliente
 *   ou fontes), não de curadoria.
 * - **Chegou e ninguém triou.** É o caso de quem nunca teve rascunho do mês:
 *   "candidatas" sai de `article_client_tags` (janela rolante de 30 dias), mas
 *   triagem e verificação leem `report_evidence_items`, que só existe depois de
 *   "Preparar mês".
 * - **Triou e não verificou.** A triagem por IA grava `qa_checked_at` nulo
 *   (src/app/api/report-drafts/[id]/triage/route.ts) e o filtro de "qualificada"
 *   do Painel exige esse carimbo — só o estágio `verify` o produz. O dado está
 *   certo; era a tela que mostrava zero sem dizer que faltava uma etapa.
 *   Foi o caso do SINDINFOR em setembro/2026: 26 triadas, 0 qualificadas.
 */

export interface QualificationCounts {
  total: number
  triaged_count: number
  qualified_count: number
}

export interface QualificationNote {
  /** Frase curta sob o número. Vazia quando o número se explica sozinho. */
  text: string
  /** `true` quando há trabalho represado que o operador pode destravar. */
  actionable: boolean
}

export function describeQualification(counts: QualificationCounts): QualificationNote {
  const { total, triaged_count: triaged, qualified_count: qualified } = counts

  if (qualified > 0) return { text: '', actionable: false }

  if (total <= 0) {
    return { text: 'nenhuma candidata no período — verifique fontes e regras', actionable: false }
  }

  if (triaged <= 0) {
    return { text: `${total} candidatas aguardando triagem`, actionable: true }
  }

  // Triado mas sem carimbo de verificação: o trabalho existe e está a um
  // estágio de virar número.
  return { text: `${triaged} triadas, aguardando verificação`, actionable: true }
}
