import type { AccessMode } from '@/types'

/**
 * `sources.access_mode` deixa de ser metadado decorativo e passa a ser trava.
 *
 * A coluna existe desde a migration 023 com CHECK de três valores, é escrita por
 * cinco migrations de semeadura — e NUNCA foi lida como condição em lugar
 * nenhum. Enquanto isso o clipping mensal reproduz `articles.content` inteiro
 * num PDF entregue ao cliente. Reproduzir a íntegra de uma matéria de um veículo
 * que só autoriza referência é problema de direito autoral (Lei 9.610/1998
 * distingue citação de reprodução), e o risco é do cliente, não nosso.
 *
 * Semântica dos três modos:
 * - `publico`     — reprodução da íntegra permitida.
 * - `licenciado`  — permitida porque existe licença ou o documento foi entregue
 *                   pelo próprio cliente (é o modo da fonte "Documentos
 *                   importados", criada na 023).
 * - `referencia`  — SOMENTE referência: veículo, título, data e link. A íntegra
 *                   não vai para o PDF.
 *
 * Valor desconhecido é tratado como `referencia`. Negar por precaução é o único
 * default defensável: o custo de errar para o lado permissivo é jurídico e recai
 * sobre o entregável já impresso.
 */

const RANK: Record<AccessMode, number> = { publico: 0, licenciado: 1, referencia: 2 }

export function normalizeAccessMode(value: string | null | undefined): AccessMode {
  return value === 'publico' || value === 'licenciado' || value === 'referencia' ? value : 'referencia'
}

/**
 * O modo mais restritivo entre vários — um artigo pode chegar por mais de uma
 * fonte (`article_provenance`), e a permissão não pode ser a da fonte mais
 * frouxa. Lista vazia devolve `referencia`, pelo mesmo motivo do default.
 */
export function strictestAccessMode(values: Array<string | null | undefined>): AccessMode {
  if (!values.length) return 'referencia'
  return values
    .map(normalizeAccessMode)
    .reduce<AccessMode>((strictest, mode) => (RANK[mode] > RANK[strictest] ? mode : strictest), 'publico')
}

export function canReproduceIntegra(value: string | null | undefined): boolean {
  return normalizeAccessMode(value) !== 'referencia'
}

/** Frase que vai ao PDF no lugar do texto — diz o motivo, não "indisponível". */
export const REPRODUCTION_BLOCKED_NOTICE =
  'Texto integral não reproduzido: a fonte está cadastrada como somente referência. Consulte a publicação original pelo link.'
