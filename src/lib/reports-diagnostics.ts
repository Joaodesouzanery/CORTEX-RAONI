import type { ReportDraftStatus } from '@/types'

/**
 * Explica por que a lista de Relatórios está vazia.
 *
 * A lista antes fazia `Array.isArray(d) ? d : []`, então um erro 500 renderizava
 * exatamente igual a uma tabela vazia — e a cópia do estado vazio apontava para
 * um fluxo que não existe mais ("selecione artigos em Notícias"). O único
 * produtor de linhas em `reports` alcançável pela UI é o `finalize`, atrás de
 * cinco travas; o normal é a tabela estar mesmo vazia porque nenhuma preparação
 * chegou ao fim.
 *
 * Deliberadamente NÃO replica as cinco travas do finalize: elas já são
 * reportadas com `code` no momento do clique em Finalizar, e duplicá-las aqui
 * apodreceria. Esta função aponta para o rascunho mais avançado; o motivo exato
 * está lá dentro.
 */
export interface DraftSummary {
  id: string
  status: ReportDraftStatus
  period_month: string
  client_id: string
  clients?: { name?: string } | null
}

export interface NoReportsDiagnosis {
  headline: string
  detail: string
  cta: { href: string; label: string } | null
}

const STATUS_LABEL: Record<string, [string, string]> = {
  preparing: ['em preparação', 'em preparação'],
  triaging: ['em triagem', 'em triagem'],
  ready: ['pronta para gerar', 'prontas para gerar'],
  generating: ['gerando seções', 'gerando seções'],
  review: ['em revisão', 'em revisão'],
  approved: ['aprovada', 'aprovadas'],
  stale: ['obsoleta', 'obsoletas'],
  error: ['com erro', 'com erro'],
}

/** Ordem de progresso: o rascunho mais avançado é o melhor destino. */
const PROGRESSO: ReportDraftStatus[] = [
  'error',
  'stale',
  'preparing',
  'triaging',
  'ready',
  'generating',
  'review',
  'approved',
]

function descreverStatus(drafts: DraftSummary[]): string {
  const contagem = new Map<string, number>()
  for (const draft of drafts) contagem.set(draft.status, (contagem.get(draft.status) || 0) + 1)
  return Array.from(contagem.entries())
    .sort((a, b) => PROGRESSO.indexOf(b[0] as ReportDraftStatus) - PROGRESSO.indexOf(a[0] as ReportDraftStatus))
    .map(([status, n]) => {
      const rotulo = STATUS_LABEL[status] || [status, status]
      return `${n} ${n === 1 ? rotulo[0] : rotulo[1]}`
    })
    .join(', ')
}

function maisAvancado(drafts: DraftSummary[]): DraftSummary | null {
  if (!drafts.length) return null
  return [...drafts].sort((a, b) => PROGRESSO.indexOf(a.status) - PROGRESSO.indexOf(b.status)).at(-1) || null
}

export function describeWhyNoReports(drafts: DraftSummary[]): NoReportsDiagnosis {
  if (!drafts.length) {
    return {
      headline: 'Nenhum relatório e nenhuma preparação.',
      detail:
        'O relatório nasce de uma preparação mensal finalizada. Comece uma para este período.',
      cta: { href: '/reports/prepare', label: 'Abrir preparação mensal' },
    }
  }

  const aprovadas = drafts.filter((d) => d.status === 'approved')
  if (aprovadas.length) {
    // Estado que significa bug de verdade: existe preparação aprovada mas
    // nenhuma linha em `reports`.
    return {
      headline: 'Há preparação aprovada sem relatório correspondente.',
      detail:
        `${aprovadas.length} preparação(ões) aprovada(s), mas a lista veio vazia — ` +
        'provavelmente falha de leitura. Recarregue; se persistir, é defeito.',
      cta: { href: '/reports/prepare', label: 'Ver preparações' },
    }
  }

  const alvo = maisAvancado(drafts)
  const nome = alvo?.clients?.name
  const periodo = alvo?.period_month?.slice(0, 7)
  return {
    headline: `${drafts.length} preparação(ões) em andamento, nenhuma finalizada.`,
    detail:
      `${descreverStatus(drafts)}. O relatório só aparece aqui depois de Finalizar ` +
      'a preparação — que confere matéria principal, seções, portões de qualidade e checklist.',
    cta: alvo
      ? {
          href: `/reports/prepare?draft=${alvo.id}`,
          label: `Continuar ${nome ? `${nome} · ` : ''}${periodo || ''}`.trim(),
        }
      : { href: '/reports/prepare', label: 'Abrir preparação mensal' },
  }
}
