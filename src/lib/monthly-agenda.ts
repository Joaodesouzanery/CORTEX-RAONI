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

// ---------------------------------------------------------------------------
// Semeadura da agenda de um rascunho mensal.
//
// A triagem devolve 409 quando o rascunho não tem nenhum tópico, então um
// cliente novo (a PRIO é o caso vivo: regras por migration, sem templates)
// trava a preparação inteira. Estes quatro níveis resolvem isso sem fabricar
// obrigação editorial: só os níveis 1 e 2 produzem tópicos `required`.
// ---------------------------------------------------------------------------

import type { SupabaseClient } from '@supabase/supabase-js'
import { monthBounds } from '@/lib/report-drafts'

type SeededTopic = {
  draft_id: string
  title: string
  rationale: string
  inclusion_terms: string[]
  exclusion_terms: string[]
  required: boolean
  position: number
}

export type AgendaSeedTier = 'existente' | 'template' | 'periodo_anterior' | 'derivada'

function priorPeriod(period: string) {
  const [year, month] = period.slice(0, 7).split('-').map(Number)
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`
}

/**
 * Garante que o rascunho tenha agenda, na primeira fonte que produzir tópicos:
 *
 *  1. tópicos já presentes no rascunho;
 *  2. `client_report_topic_templates` ativos (comportamento histórico);
 *  3. tópicos do rascunho do período anterior do mesmo cliente;
 *  4. derivação do perfil editorial (`permanent_axes`) e das keywords.
 *
 * Os derivados entram com `required: false` — liberam a triagem sem inventar
 * cobertura obrigatória — e abrem um alerta operacional para alguém definir a
 * agenda de verdade. Deliberadamente NÃO são gravados de volta em
 * `client_report_topic_templates`: uma derivação ruim viraria permanente e
 * composta todo mês. A promoção é uma decisão humana.
 */
export const PROVISIONAL_RATIONALE =
  'Agenda provisória derivada do perfil editorial — confirme antes do fechamento.'

/**
 * Deriva uma agenda provisória para um cliente sem templates nem histórico.
 *
 * Sempre `required: false`: libera o 409 da triagem sem fabricar cobertura
 * obrigatória, que é o que `uncoveredRequiredTopics` usa para bloquear o
 * fechamento. Um eixo permanente vira um tópico; sem eixos, as keywords do
 * cliente viram um único tópico guarda-chuva.
 */
export function deriveProvisionalTopics(
  axes: string[],
  keywords: string[],
  clientName?: string | null
): Array<Omit<SeededTopic, 'draft_id' | 'position'>> {
  const cleanAxes = axes.map((axis) => axis.trim()).filter(Boolean)
  if (cleanAxes.length) {
    return cleanAxes.map((axis) => ({
      title: axis,
      rationale: PROVISIONAL_RATIONALE,
      inclusion_terms: [axis],
      exclusion_terms: [],
      required: false,
    }))
  }
  const cleanKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean)
  if (!cleanKeywords.length) return []
  return [
    {
      title: `Cobertura geral — ${clientName || 'cliente'}`,
      rationale: PROVISIONAL_RATIONALE,
      inclusion_terms: cleanKeywords.slice(0, 12),
      exclusion_terms: [],
      required: false,
    },
  ]
}

export async function seedDraftTopics(
  supabase: SupabaseClient,
  draftId: string,
  clientId: string,
  periodMonth?: string
): Promise<{ inserted: number; tier: AgendaSeedTier }> {
  const [{ data: existing }, { data: templates, error }] = await Promise.all([
    supabase.from('monthly_report_topics').select('title, position').eq('draft_id', draftId),
    supabase
      .from('client_report_topic_templates')
      .select('title, rationale, inclusion_terms, exclusion_terms, required')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('position'),
  ])
  if (error) throw new Error(error.message)

  const titles = new Set((existing || []).map((topic) => topic.title))
  let position = Math.max(0, ...(existing || []).map((topic) => Number(topic.position || 0)))
  const nextPosition = () => ++position

  const missing: SeededTopic[] = (templates || [])
    .filter((topic) => !titles.has(topic.title))
    .map((topic) => ({
      draft_id: draftId,
      title: topic.title,
      rationale: topic.rationale,
      inclusion_terms: topic.inclusion_terms,
      exclusion_terms: topic.exclusion_terms,
      required: topic.required,
      position: nextPosition(),
    }))
  if (missing.length) {
    const { error: insertError } = await supabase.from('monthly_report_topics').insert(missing)
    if (insertError) throw new Error(insertError.message)
    return { inserted: missing.length, tier: (existing || []).length ? 'existente' : 'template' }
  }
  if ((existing || []).length) return { inserted: 0, tier: 'existente' }

  // Nível 3 — repetir a agenda do mês anterior.
  const period = (periodMonth || '').slice(0, 7)
  if (/^\d{4}-\d{2}$/.test(period)) {
    const { data: priorDraft } = await supabase
      .from('monthly_report_drafts')
      .select('id')
      .eq('client_id', clientId)
      .eq('period_month', monthBounds(priorPeriod(period)).date)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (priorDraft) {
      const { data: priorTopics } = await supabase
        .from('monthly_report_topics')
        .select('title, rationale, inclusion_terms, exclusion_terms, required')
        .eq('draft_id', priorDraft.id)
        .order('position')
      const carried: SeededTopic[] = (priorTopics || []).map((topic) => ({
        draft_id: draftId,
        title: topic.title,
        rationale: topic.rationale,
        inclusion_terms: topic.inclusion_terms || [],
        exclusion_terms: topic.exclusion_terms || [],
        required: topic.required,
        position: nextPosition(),
      }))
      if (carried.length) {
        const { error: carryError } = await supabase.from('monthly_report_topics').insert(carried)
        if (carryError) throw new Error(carryError.message)
        return { inserted: carried.length, tier: 'periodo_anterior' }
      }
    }
  }

  // Nível 4 — derivar do perfil editorial. Provisória por construção.
  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase.from('client_editorial_profiles').select('permanent_axes').eq('client_id', clientId).maybeSingle(),
    supabase.from('clients').select('name, keywords').eq('id', clientId).maybeSingle(),
  ])
  const axes = Array.isArray(profile?.permanent_axes)
    ? (profile.permanent_axes as unknown[]).filter((axis): axis is string => typeof axis === 'string' && Boolean(axis.trim()))
    : []
  const keywords = Array.isArray(client?.keywords)
    ? (client.keywords as string[]).filter((keyword) => Boolean(keyword?.trim()))
    : []
  const derived: SeededTopic[] = deriveProvisionalTopics(axes, keywords, client?.name).map((topic) => ({
    draft_id: draftId,
    ...topic,
    position: nextPosition(),
  }))
  if (!derived.length) return { inserted: 0, tier: 'derivada' }

  const { error: derivedError } = await supabase.from('monthly_report_topics').insert(derived)
  if (derivedError) throw new Error(derivedError.message)
  await supabase.from('operational_alerts').upsert(
    {
      fingerprint: `agenda_missing:${clientId}:${period || 'sem-periodo'}`,
      kind: 'agenda_missing',
      severity: 'warning',
      status: 'open',
      client_id: clientId,
      title: `Agenda provisória em uso: ${client?.name || 'cliente'}`,
      details: { period, derived_from: axes.length ? 'permanent_axes' : 'keywords', topics: derived.length },
      last_seen_at: new Date().toISOString(),
      resolved_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'fingerprint' }
  )
  return { inserted: derived.length, tier: 'derivada' }
}
