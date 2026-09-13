/**
 * Comparação de strings em tempo constante.
 *
 * Roda no runtime Edge (middleware), onde `node:crypto` e portanto
 * `timingSafeEqual` não existem — daí a implementação manual.
 *
 * O ganho prático contra um segredo de alta entropia via HTTP é pequeno, mas o
 * custo de fazer certo é zero e a comparação `===` de um segredo é o tipo de
 * coisa que aparece mal num laudo de segurança.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  // O comprimento vaza de qualquer forma pelo tamanho da resposta; o que não
  // pode vazar é a posição do primeiro caractere divergente.
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Confere um header `Authorization: Bearer <segredo>` em tempo constante. */
export function bearerMatches(header: string | null, secret: string | undefined): boolean {
  // Sem segredo configurado NUNCA é "autorizado". Falhar aberto aqui foi o
  // defeito original de internalAuthorized().
  if (!secret) return false
  if (!header) return false
  return constantTimeEquals(header, `Bearer ${secret}`)
}
