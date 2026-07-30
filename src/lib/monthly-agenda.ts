import type { ArticleSnapshot, MonthlyReportTopic } from '@/types'
import { normalizeText } from '@/lib/relevance'

const MINING_CONTEXT =
  /\b(mineracao|mineral|minerais|mineradora|lavra|garimpo|anm|cfem|carajas|mina|minas|bauxita|cobre|niquel|ferro)\b/
const WEAK_CONTEXT_TERMS = new Set(['para', 'amazonia', 'sustentabilidade', 'comunidades', 'biodiversidade'])

export function topicMatchesArticle(
  topic: Pick<MonthlyReportTopic, 'title' | 'inclusion_terms' | 'exclusion_terms'>,
  article: Pick<ArticleSnapshot, 'title' | 'excerpt' | 'content'>
) {
  const text = normalizeText([article.title, article.excerpt, article.content].filter(Boolean).join(' '))
  if (!text) return { matched: false, terms: [] as string[] }
  const excluded = topic.exclusion_terms.some((term) => text.includes(normalizeText(term)))
  if (excluded) return { matched: false, terms: [] as string[] }
  const terms = topic.inclusion_terms.filter((term) => {
    const normalized = normalizeText(term)
    if (!normalized || !text.includes(normalized)) return false
    if (WEAK_CONTEXT_TERMS.has(normalized) && !MINING_CONTEXT.test(text)) return false
    return true
  })
  const title = normalizeText(topic.title)
  // Agendas compostas representam uma relação editorial, não um OR de
  // palavras. "Mineração" sozinha, por exemplo, não cobre sustentabilidade
  // nem Amazônia.
  if (title.includes('mineracao e sustentabilidade')) {
    const sustainability = /\b(sustentabilidade|licenciamento ambiental|biodiversidade|comunidades|descarbonizacao|legado)\b/
    return {
      matched: MINING_CONTEXT.test(text) && sustainability.test(text),
      terms,
    }
  }
  if (title.includes('mineracao e amazonia')) {
    const amazon = /\b(amazonia|amazonico|amazonica|bioma amazonico|carajas)\b/
    return {
      matched: MINING_CONTEXT.test(text) && amazon.test(text),
      terms,
    }
  }
  return { matched: terms.length > 0, terms }
}

export const SIMINERAL_JULY_2026_TOPICS = [
  {
    position: 1,
    title: 'Decreto e regulação de cavidades',
    rationale: 'Acompanhar o marco de cavidades naturais, inclusive declarações de Alexandre Silveira.',
    inclusion_terms: ['cavidade', 'cavidades', 'caverna', 'espeleologia', 'Alexandre Silveira'],
    exclusion_terms: [],
  },
  {
    position: 2,
    title: 'Minerais críticos e estratégicos',
    rationale: 'Política, investimentos, cadeias produtivas e posicionamento do Brasil e do Pará.',
    inclusion_terms: ['minerais críticos', 'minerais estratégicos', 'terras raras', 'lítio', 'níquel', 'cobre'],
    exclusion_terms: ['ETF', 'carteira recomendada'],
  },
  {
    position: 3,
    title: 'Mineração e sustentabilidade',
    rationale: 'Licenciamento, clima, biodiversidade, comunidades, descarbonização e legado.',
    inclusion_terms: ['mineração', 'sustentabilidade', 'licenciamento ambiental', 'biodiversidade', 'comunidades'],
    exclusion_terms: ['criptomoeda'],
  },
  {
    position: 4,
    title: 'Mineração e Amazônia',
    rationale: 'Impactos, oportunidades, governança e desenvolvimento mineral na Amazônia.',
    inclusion_terms: ['mineração', 'Amazônia', 'bioma amazônico', 'Carajás'],
    exclusion_terms: ['mineração de criptomoedas'],
  },
  {
    position: 5,
    title: 'Mineração no Pará',
    rationale: 'Operações, regulação, investimentos, municípios e desenvolvimento do setor mineral paraense.',
    inclusion_terms: [
      'mineração no Pará',
      'setor mineral do Pará',
      'Carajás',
      'Parauapebas',
      'Canaã dos Carajás',
      'Oriximiná',
      'Juruti',
    ],
    exclusion_terms: [],
  },
] as const
