// Ruído editorial por SEÇÃO do veículo, não por palavra solta no texto.
//
// Por quê: a 050 excluía "novela", "Brasileirão" etc. testando o corpo
// inteiro da matéria. Isso tirava futebol, mas também matava "a novela do
// leilão de transmissão". O dono pediu (08/11/2026) para manter os grandes
// veículos — Globo, Estadão, Folha, UOL — e só segmentar melhor. A seção do
// link (/esporte/, ge.globo.com, /famosos/) diz do que a matéria trata sem
// depender de vocabulário, e um veículo nunca publica leilão de energia
// dentro do caderno de esporte.
//
// Vale só para casamento de SETOR. Menção direta ao cliente sempre passa:
// "ONS corta energia para evitar apagões em jogos do Brasil na Copa" (UOL,
// entregue no relatório) é notícia do cliente mesmo vindo de pauta esportiva.

// Hosts inteiros que só publicam esporte/entretenimento.
const OFF_TOPIC_HOSTS = [
  'ge.globo.com',
  'gshow.globo.com',
  'globoesporte.globo.com',
  'esporte.uol.com.br',
  'esportes.estadao.com.br',
  'lance.com.br',
  'placar.abril.com.br',
  'trivela.com.br',
  'gazetaesportiva.com',
  'quem.globo.com',
  'ofuxico.com.br',
  'natelinha.uol.com.br',
  'purepeople.com.br',
  'contigo.com.br',
  'capricho.abril.com.br',
]

// Primeiro ou segundo segmento do caminho. Segundo porque vários portais
// prefixam a editoria com a praça ("/rj/esporte/", "/pe/famosos/").
const OFF_TOPIC_SECTIONS = new Set([
  'esporte',
  'esportes',
  'futebol',
  'futebol-internacional',
  'brasileirao',
  'libertadores',
  'copa-do-brasil',
  'formula-1',
  'f1',
  'nba',
  'tenis',
  'volei',
  'mma',
  'entretenimento',
  'famosos',
  'celebridades',
  'gente',
  'pop-arte',
  'pop',
  'novelas',
  'novela',
  'tv-e-novelas',
  'bbb',
  'reality',
  'horoscopo',
  'astrologia',
  'signos',
  'receitas',
  'gastronomia',
  'moda',
  'beleza',
  'loterias',
])

// Título que é placar ou rodada, para feeds sem seção no link (Google News
// devolve news.google.com/rss/articles/... até o link ser resolvido).
// Sem placar numérico ("2 x 1"): casaria tabela de tarifa e "4 x 4".
const OFF_TOPIC_TITLE = /\b(brasileirao|libertadores|copa do brasil|rodada do campeonato|escalacao|horoscopo do dia|bbb\s*\d+)\b/

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function isOffTopicSection(url: string | null | undefined, title?: string | null): boolean {
  if (title && OFF_TOPIC_TITLE.test(normalize(title))) return true
  if (!url) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (OFF_TOPIC_HOSTS.some((item) => host === item || host.endsWith(`.${item}`))) return true
  if (/^(esporte|esportes|entretenimento|famosos|celebridades|gente)\./.test(host)) return true
  const segments = parsed.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => normalize(decodeURIComponent(segment)))
  return segments.some((segment) => OFF_TOPIC_SECTIONS.has(segment))
}
