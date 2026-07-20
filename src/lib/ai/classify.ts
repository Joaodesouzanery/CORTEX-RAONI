import type { Article, Tom, Relevancia } from '@/types'
import { parseKeywords, expandTerms, relevanceScore, normalizeText, matchKeyword, type ParsedKeyword } from '@/lib/relevance'

// Suggested reputational tags for one article/client. Feeds the "Sugerir tags"
// flow — the human still confirms/adjusts. Deterministic by default; the
// Anthropic call is the ONLY AI dependency and is isolated in classifyWithAI().
export interface TagSuggestion {
  article_id: string
  tom: Tom | null
  relevancia: Relevancia | null
  cita_cliente: boolean | null
  tema: string | null
}

export interface ClassifyClient {
  name: string
  keywords?: string[] | null
  synonyms?: string | null
}

// The AI plug-in is dormant until ANTHROPIC_API_KEY is set. "Ligar a IA" = set
// the key; no other code changes. Without it, suggestTags falls back to the
// deterministic heuristic below.
export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

// --- Deterministic heuristic (no AI) --------------------------------------

// Small PT-BR lexicons for a best-effort tom guess. Normalized (no accents).
// Intentionally conservative: no signal → null (leave tom for the human/AI).
const POS = new Set([
  'avanco', 'avanca', 'investimento', 'aprovacao', 'aprova', 'aprovado', 'conclui', 'concluida',
  'entrega', 'entregue', 'sucesso', 'beneficio', 'cresce', 'crescimento', 'amplia', 'ampliacao',
  'moderniza', 'modernizacao', 'inaugura', 'ganho', 'melhora', 'recorde', 'expansao', 'acordo',
  'parceria', 'positivo', 'reforca', 'impulsiona',
])
const NEG = new Set([
  'crise', 'falha', 'atraso', 'atrasa', 'risco', 'apagao', 'corte', 'problema', 'denuncia',
  'suspensao', 'suspende', 'alerta', 'temor', 'adiamento', 'adia', 'prejuizo', 'queda', 'multa',
  'irregularidade', 'investigacao', 'paralisacao', 'greve', 'acidente', 'morte', 'negativo',
  'critica', 'fraude', 'sobrepreco', 'gargalo', 'colapso',
])

function tomFromText(text: string): Tom | null {
  const tokens = normalizeText(text).split(' ')
  let pos = 0
  let neg = 0
  for (const t of tokens) {
    if (POS.has(t)) pos++
    if (NEG.has(t)) neg++
  }
  if (pos === 0 && neg === 0) return null
  if (pos > neg) return 'positivo'
  if (neg > pos) return 'negativo'
  return 'neutro'
}

function relevanciaFromScore(score: number): Relevancia {
  if (score >= 3) return 'alta'
  if (score >= 1) return 'media'
  return 'baixa'
}

// Whole-token match on the client name (via relevance.ts) so an acronym like
// "ONS" doesn't falsely match inside "responsável".
function citesClient(nameKw: ParsedKeyword[], title: string, excerpt: string | null): boolean {
  if (!nameKw.length) return false
  const hay = normalizeText([title, excerpt].filter(Boolean).join(' '))
  return nameKw.some((kw) => matchKeyword(kw, hay))
}

function temaFromKeywords(parsed: ParsedKeyword[], title: string, excerpt: string | null): string | null {
  const titleNorm = normalizeText(title)
  for (const kw of parsed) if (matchKeyword(kw, titleNorm)) return kw.raw
  const bodyNorm = normalizeText(excerpt || '')
  for (const kw of parsed) if (matchKeyword(kw, bodyNorm)) return kw.raw
  return null
}

/** Pure, testable deterministic suggestion for one article. */
export function heuristicSuggest(
  article: Article,
  client: ClassifyClient,
  parsed?: ParsedKeyword[],
  nameKw?: ParsedKeyword[]
): TagSuggestion {
  const kws = parsed ?? parseKeywords(expandTerms(client.keywords, client.synonyms))
  const nk = nameKw ?? parseKeywords([client.name])
  const fields = { title: article.title, excerpt: article.excerpt }
  return {
    article_id: article.id,
    tom: tomFromText([article.title, article.excerpt].filter(Boolean).join('. ')),
    relevancia: relevanciaFromScore(relevanceScore(kws, fields)),
    cita_cliente: citesClient(nk, article.title, article.excerpt ?? null),
    tema: temaFromKeywords(kws, article.title, article.excerpt ?? null),
  }
}

/** Deterministic batch — used directly in tests and as the no-key fallback. */
export function suggestTagsHeuristic(articles: Article[], client: ClassifyClient): TagSuggestion[] {
  const parsed = parseKeywords(expandTerms(client.keywords, client.synonyms))
  const nameKw = parseKeywords([client.name])
  return articles.map((a) => heuristicSuggest(a, client, parsed, nameKw))
}

// --- AI plug-in (isolated; dormant without the key) ------------------------

function coerceTom(v: unknown): Tom | null {
  return v === 'positivo' || v === 'neutro' || v === 'negativo' || v === 'critico' ? v : null
}
function coerceRel(v: unknown): Relevancia | null {
  return v === 'alta' || v === 'media' || v === 'baixa' ? v : null
}
function parseJsonArray(text: string): Array<Record<string, unknown>> {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const CLASSIFY_MODEL = 'claude-haiku-4-5-20251001'
const BATCH = 30

async function classifyWithAI(articles: Article[], client: ClassifyClient): Promise<TagSuggestion[]> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const out: TagSuggestion[] = []

  for (let i = 0; i < articles.length; i += BATCH) {
    const batch = articles.slice(i, i + BATCH)
    const list = batch
      .map((a, j) => `${j}. ${a.title}${a.excerpt ? ` — ${a.excerpt.slice(0, 240)}` : ''}`)
      .join('\n')
    const system = `Você é um analista de inteligência reputacional do cliente "${client.name}". Classifique cada matéria de imprensa. Campos:
- tom: "positivo" | "neutro" | "negativo" | "critico" (para a reputação do cliente/setor)
- relevancia: "alta" | "media" | "baixa"
- cita_cliente: true se cita o cliente diretamente; false se é tema do setor sob outro protagonista
- tema: rótulo de 1 a 3 palavras
Responda SOMENTE com um array JSON, um objeto por item, no formato exato:
[{"i":0,"tom":"neutro","relevancia":"media","cita_cliente":false,"tema":"..."}]`

    const message = await anthropic.messages.create({
      model: CLASSIFY_MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: list }],
    })
    const block = message.content.find((b) => b.type === 'text')
    const text = block && block.type === 'text' ? block.text : '[]'
    for (const item of parseJsonArray(text)) {
      const idx = typeof item.i === 'number' ? item.i : NaN
      const a = batch[idx]
      if (!a) continue
      out.push({
        article_id: a.id,
        tom: coerceTom(item.tom),
        relevancia: coerceRel(item.relevancia),
        cita_cliente: typeof item.cita_cliente === 'boolean' ? item.cita_cliente : null,
        tema: item.tema ? String(item.tema).slice(0, 60) : null,
      })
    }
  }
  return out
}

/**
 * Suggest tags for a batch. Uses the Anthropic plug-in when the key is present,
 * otherwise the deterministic heuristic. Never throws for the caller: if the AI
 * call fails, it falls back to the heuristic.
 */
export async function suggestTags(articles: Article[], client: ClassifyClient): Promise<TagSuggestion[]> {
  if (aiEnabled()) {
    try {
      const ai = await classifyWithAI(articles, client)
      if (ai.length) return ai
    } catch {
      // fall through to heuristic
    }
  }
  return suggestTagsHeuristic(articles, client)
}
