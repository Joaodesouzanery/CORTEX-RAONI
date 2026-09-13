/**
 * Escolha de imagem de artigo — puro, sem rede.
 *
 * Nasce de dois defeitos confirmados em produção:
 *
 * 1. O link do Google News redireciona para SI MESMO (o redirecionamento real é
 *    por JavaScript, que o fetch não executa). A página de chegada tem og:image,
 *    e é O MESMO logo do Google para TODOS os artigos. O backfill gravava esse
 *    logo em `articles.image_url` e, como ele filtra `.is('image_url', null)`,
 *    o artigo ficava EXCLUÍDO PARA SEMPRE de nova tentativa.
 *
 * 2. Em páginas gov.br o og:image é o BRASÃO da agência, não a foto da matéria.
 *    Como a escolha era "primeiro candidato vence" e og:image vem primeiro,
 *    a extração do corpo nunca era alcançada.
 *
 * A correção dos dois é a mesma reordenação: primeiro candidato NÃO-GENÉRICO
 * vence, e null é melhor que uma imagem errada.
 */

/** Hosts que, neste pipeline, só servem logo/placeholder. */
const GENERIC_HOSTS = new Set([
  'lh3.googleusercontent.com', // o logo do Google News
  'news.google.com',
  'www.google.com',
  'ssl.gstatic.com',
  'www.gstatic.com',
])

const GENERIC_PATH =
  /(logo|logotipo|marca[-_ ]?dagua|bras[aã]o|brasao|placeholder|default|padr[aã]o|avatar|favicon|apple-touch-icon|android-chrome|mstile|sem[-_ ]?imagem|no[-_ ]?image|og[-_ ]?default|share[-_ ]?image|generic|sprite)/i

export function isGenericImage(url: string | null | undefined): boolean {
  if (!url) return true
  const text = url.trim()
  if (!text || text.startsWith('data:')) return true
  let parsed: URL
  try {
    parsed = new URL(text)
  } catch {
    return true
  }
  if (GENERIC_HOSTS.has(parsed.hostname.toLowerCase())) return true
  if (GENERIC_PATH.test(parsed.pathname)) return true
  // Foto de matéria nunca é SVG; brasão de gov.br frequentemente é.
  if (/\.svg($|\?)/i.test(parsed.pathname)) return true
  if (/(^|\/)(1x1|pixel|spacer)([.\-_]|$)/i.test(parsed.pathname)) return true
  if (/\.gif($|\?)/i.test(parsed.pathname)) return true
  return false
}

/** Absolutiza contra a URL final, resolvendo `//host/x` e caminhos relativos. */
function absolutize(candidate: string, finalUrl: string): string | null {
  let img = candidate.trim()
  if (!img) return null
  if (img.startsWith('//')) img = 'https:' + img
  try {
    return new URL(img, finalUrl).href
  } catch {
    return null
  }
}

/**
 * Primeiro candidato NÃO-GENÉRICO vence — era "primeiro candidato vence".
 * Devolve null quando todos são genéricos: null deixa o artigo elegível a uma
 * nova tentativa; uma imagem errada o marca como resolvido para sempre.
 */
export function pickImageCandidate(
  candidates: Array<string | null | undefined>,
  finalUrl: string
): string | null {
  for (const candidate of candidates) {
    if (!candidate) continue
    const absolute = absolutize(candidate, finalUrl)
    if (absolute && !isGenericImage(absolute)) return absolute
  }
  return null
}
