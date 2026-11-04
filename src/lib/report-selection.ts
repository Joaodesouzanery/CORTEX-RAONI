// Seleção determinística das matérias da base qualificada (sem IA).
//
// Engenharia reversa de outubro/2026: o CSV exportado tinha 600+ linhas por
// cliente, 70–93% com link do Google News sem resolver e nenhuma qualificada.
// O modelo de linguagem escolheu, então, o que tinha link direto — e os
// relatórios puxaram para veículos especializados, Minas em vez do Pará,
// rodovia na DAQ. Esta seleção fixa as regras antes de qualquer modelo:
// só link exato, só o mês, cliente primeiro, grandes veículos, sem repetir pauta.

/** Pedido do cliente (out/2026): 20 notícias por relatório, nem mais nem menos quando houver. */
export const REPORT_ITEMS = 20

export interface SelectionCandidate {
  id: string
  title: string
  url: string | null
  outlet: string | null
  published_at: string | null
  /** Cita o cliente (regra direta ou nome no título). */
  cites_client?: boolean
  score?: number | null
}

export type LinkStatus = 'exato' | 'google_news' | 'id_curto' | 'secao' | 'invalido' | 'ausente'

export interface SelectionOptions {
  /** Mês do relatório, YYYY-MM. */
  period: string
  /** Termos que identificam o cliente no título (nome, sigla, porta-vozes). */
  clientTerms?: string[]
  /** Termos que tiram a matéria do relatório deste cliente (ex.: rodovia na DAQ). */
  excludeTerms?: string[]
  limit?: number
}

export interface SelectionResult {
  selected: Array<SelectionCandidate & { block: 'Cliente' | 'Setor'; link_status: LinkStatus }>
  rejected: Array<{ item: SelectionCandidate; reason: string }>
  /** Quantas faltaram para chegar ao limite: vai escrito no pacote, nunca completado com item fraco. */
  missing: number
}

// Grandes veículos pedidos pelos clientes (reclamação de "portais desconhecidos").
const MAJOR_OUTLETS = /(valor|estad[ãa]o|folha|o globo|oglobo|g1\b|cnn|eixos|poder360|infomoney|exame|veja|ag[êe]ncia brasil|reuters|bloomberg|megawhat|canal ?energia)/i

export function linkStatus(url: string | null | undefined): LinkStatus {
  if (!url) return 'ausente'
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return 'invalido'
  }
  if (/(^|\.)news\.google\.com$/.test(parsed.hostname)) return 'google_news'
  // "?p=123" é o id interno do WordPress: o mesmo número abriu outra matéria em
  // Agência iNFRA, InfoMoney e O Fator (conferência de outubro).
  if (parsed.searchParams.has('p') && (parsed.pathname === '/' || /\/blog\/?$/.test(parsed.pathname))) return 'id_curto'
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'secao'
  // Link de editoria (/economia, /noticias/energia) não é matéria: matéria tem
  // slug longo, id numérico ou data no caminho.
  const last = segments[segments.length - 1]
  const looksLikeArticle = segments.length >= 3 || /-/.test(last) || /\d{4,}/.test(parsed.pathname)
  return looksLikeArticle ? 'exato' : 'secao'
}

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const STOPWORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'a', 'o', 'as', 'os', 'para', 'por', 'com', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'que', 'se', 'ao'])

/** Assinatura da pauta: palavras significativas do título, para não repetir o mesmo fato. */
function topicKey(title: string): Set<string> {
  return new Set(normalize(title).split(' ').filter((word) => word.length > 3 && !STOPWORDS.has(word)))
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const word of a) if (b.has(word)) shared++
  return shared / Math.min(a.size, b.size)
}

/** Acima disso dois títulos contam como a mesma pauta (ex.: mesma nota do ONS em dois veículos). */
const SAME_TOPIC_OVERLAP = 0.6

export function selectReportItems(candidates: SelectionCandidate[], options: SelectionOptions): SelectionResult {
  const limit = options.limit ?? REPORT_ITEMS
  const rejected: SelectionResult['rejected'] = []
  const clientTerms = (options.clientTerms || []).map(normalize).filter(Boolean)
  const excludeTerms = (options.excludeTerms || []).map(normalize).filter(Boolean)
  const seenUrls = new Set<string>()

  const eligible = candidates.flatMap((item) => {
    const status = linkStatus(item.url)
    if (status !== 'exato') {
      rejected.push({ item, reason: `link ${status.replace('_', ' ')}` })
      return []
    }
    if (!item.published_at || item.published_at.slice(0, 7) !== options.period) {
      rejected.push({ item, reason: item.published_at ? `fora do mês (${item.published_at.slice(0, 10)})` : 'sem data' })
      return []
    }
    const title = normalize(item.title)
    // Palavra inteira: "br" (de BR-153) não pode casar dentro de "brasil".
    const excluded = excludeTerms.find((term) => ` ${title} `.includes(` ${term} `))
    if (excluded) {
      rejected.push({ item, reason: `termo excluído: ${excluded}` })
      return []
    }
    const key = item.url!.replace(/[?#].*$/, '').replace(/\/$/, '')
    if (seenUrls.has(key)) {
      rejected.push({ item, reason: 'duplicada' })
      return []
    }
    seenUrls.add(key)
    const cites = item.cites_client === true || clientTerms.some((term) => ` ${title} `.includes(` ${term} `))
    return [{ ...item, cites_client: cites, link_status: status as LinkStatus, major: MAJOR_OUTLETS.test(item.outlet || '') || MAJOR_OUTLETS.test(item.url || '') }]
  })

  // Cliente primeiro, depois grande veículo, depois score, depois mais recente.
  eligible.sort(
    (a, b) =>
      Number(b.cites_client) - Number(a.cites_client) ||
      Number(b.major) - Number(a.major) ||
      (b.score ?? 0) - (a.score ?? 0) ||
      String(b.published_at).localeCompare(String(a.published_at))
  )

  const selected: SelectionResult['selected'] = []
  const topics: Set<string>[] = []
  for (const item of eligible) {
    if (selected.length >= limit) break
    const key = topicKey(item.title)
    if (topics.some((topic) => overlap(topic, key) >= SAME_TOPIC_OVERLAP)) {
      rejected.push({ item, reason: 'mesma pauta de outra selecionada' })
      continue
    }
    topics.push(key)
    const { major: _major, ...rest } = item
    selected.push({ ...rest, block: item.cites_client ? 'Cliente' : 'Setor' })
  }
  return { selected, rejected, missing: Math.max(0, limit - selected.length) }
}
