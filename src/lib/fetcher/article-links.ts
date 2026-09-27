/**
 * Ordena os links de uma listagem por probabilidade de serem matéria.
 *
 * `scrapeSite` coletava os links em ORDEM DO DOM e cortava nos 12 primeiros —
 * que num site de notícias são o menu: "Home", "Sobre", "Contato", "Categorias".
 * O filtro `isNavigationPage` (src/lib/fetch-run.ts) até descarta essas páginas,
 * mas só DEPOIS de baixá-las: a fonte gastava suas 12 requisições em menu e
 * entregava duas ou três matérias.
 *
 * A função abaixo REORDENA, não filtra — com a única exceção de extensões que
 * comprovadamente não são página HTML. Se a heurística errar, o resultado é no
 * máximo tão bom quanto a ordem do DOM (ainda são 12 links do mesmo conjunto),
 * nunca pior. Foi o critério de projeto: um palpite sobre a estrutura do site
 * alheio não pode custar cobertura.
 */

/** Arquivos que não rendem og:title — baixá-los é requisição jogada fora. */
const NOT_A_PAGE = /\.(pdf|zip|rar|docx?|xlsx?|pptx?|jpe?g|png|gif|webp|svg|mp[34]|avi|mov|css|js|xml|json)(\?|$)/i

/** Segmentos que quase sempre indicam índice, não matéria. */
const INDEX_SEGMENTS = new Set([
  'categoria', 'categorias', 'category', 'tag', 'tags', 'autor', 'autores', 'author',
  'sobre', 'contato', 'fale-conosco', 'busca', 'buscar', 'search', 'pagina', 'page',
  'feed', 'rss', 'privacidade', 'termos', 'login', 'entrar', 'cadastro', 'newsletter',
  'anuncie', 'expediente', 'assine', 'assinatura', 'mapa-do-site', 'sitemap',
])

/** Data no caminho: /2026/09/, /2026-09-21/ — o sinal mais forte de matéria. */
const DATE_IN_PATH = /\/(19|20)\d{2}[/-](0?[1-9]|1[0-2])([/-]|$)/

export function scoreArticleLink(link: string, siteUrl: string): number {
  let url: URL
  let site: URL
  try {
    url = new URL(link)
    site = new URL(siteUrl)
  } catch {
    return -100
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (!path || path === site.pathname.replace(/\/+$/, '')) return -50 // a própria home

  const segments = path.split('/').filter(Boolean)
  const last = segments.at(-1) || ''
  let score = 0

  if (DATE_IN_PATH.test(path)) score += 4
  // Slug: "antaq-publica-resolucoes-136-a-141" tem muitos hifens; "contato" não.
  const hyphens = (last.match(/-/g) || []).length
  if (hyphens >= 3) score += 3
  else if (hyphens >= 1) score += 1
  if (segments.length >= 2) score += 1
  if (last.length >= 20) score += 1
  // Id numérico longo também identifica matéria (/noticia/184523).
  if (/^\d{4,}$/.test(last)) score += 2

  if (segments.some((segment) => INDEX_SEGMENTS.has(segment.toLowerCase()))) score -= 5
  if (url.search) score -= 1
  if (/[?&]page=/i.test(url.search)) score -= 2

  return score
}

/**
 * Devolve os links reordenados, os mais promissores primeiro.
 * Empate preserva a ordem do DOM (sort estável), que é a ordem editorial da
 * página — costuma pôr a manchete antes do rodapé.
 */
export function rankArticleLinks(links: string[], siteUrl: string): string[] {
  return links
    .filter((link) => !NOT_A_PAGE.test(link))
    .map((link, index) => ({ link, index, score: scoreArticleLink(link, siteUrl) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.link)
}
