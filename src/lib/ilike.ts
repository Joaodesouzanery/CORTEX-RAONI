/**
 * Prepara um termo de busca para um padrão `ilike` do PostgREST.
 *
 * `%` e `_` são curingas em LIKE: digitados pelo usuário, transformam a busca
 * numa varredura de tabela inteira (`%` sozinho casa tudo) e produzem
 * resultados que ninguém pediu. `\` escapa os dois, então também precisa ser
 * escapado primeiro.
 *
 * Não é injeção — o valor vai como parâmetro, não como filtro cru (isso é o
 * `.or()`, tratado em outro lugar) — mas é entrada de usuário que nunca esteve
 * exposta na UI até agora.
 */
const MAX_TERM_LENGTH = 120

export function escapeIlikeTerm(raw: string): string {
  return raw.slice(0, MAX_TERM_LENGTH).replace(/[\\%_]/g, (char) => `\\${char}`)
}

/** `null` quando o termo é curto demais para valer uma varredura. */
export function ilikePattern(raw: string | null | undefined): string | null {
  const term = (raw || '').trim()
  if (term.length < 2) return null
  return `%${escapeIlikeTerm(term)}%`
}
