import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DeliveryComparisonSummary,
  DirectiveCategory,
  ReportEvidenceItem,
  ReportSection,
} from '@/types'
import { buildQualifiedSection, reportEvidenceItems } from '@/lib/report-drafts'
import { normalizeText } from '@/lib/relevance'

const PLACEHOLDER_RE = /\[(?:A\s+PREENCHER|PENDENTE|INSERIR|COMPLETAR)[^\]]*\]/gi
const REGULATORY_RE = /\b(?:decreto|lei|resolu[cç][aã]o|portaria|pdl|adi)\s*(?:n[º°o]\s*)?[\d.]+(?:\/\d{4})?\b/gi
const STRATEGIC_TERMS = [
  'vacatio legis',
  'vacatio',
  'marco civil da internet',
  'responsabilidade de plataformas',
  'plataformas digitais',
  'stf',
  'moderação de conteúdo',
  'minerais críticos',
  'regulação de cavidades',
  'curtailment',
  'mercado livre',
  'segurança do sin',
  'hidrovia',
]
const NARRATIVE_SIGNALS = [
  'visão geral',
  'inserções sobre',
  'calmaria operacional',
  'oportunidade de posicionamento',
  'liderança institucional',
  'recomenda-se',
  'só duas menções',
  'apenas duas menções',
]
const VISUAL_SIGNALS = [
  'floresta amazônica',
  'paisagem paraense',
  'rios da amazônia',
  'mineração e território',
  'infográfico',
  'mapa temático',
]

function unique(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = normalizeText(value)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function headings(text: string) {
  return text
    .split('\n')
    .map((raw) => ({ raw: raw.trim(), clean: raw.replace(/^#{1,6}\s*/, '').trim() }))
    .filter(({ raw, clean }) => {
      if (clean.length < 8 || clean.length > 140) return false
      const letters = clean.replace(/[^\p{L}]/gu, '')
      return /^#{1,6}\s/.test(raw) ||
        /^\d+(?:\.\d+)*[.)\s-]/.test(clean) ||
        (letters.length >= 6 && clean === clean.toLocaleUpperCase('pt-BR'))
    })
    .map(({ clean }) => clean)
    .filter(
      (line) =>
        !/\.(?:md|csv|json|txt)$/i.test(line) &&
        !/^(?:relat[oó]rio mensal|nota de m[eé]todo|sum[aá]rio executivo|temas estrat[eé]gicos|leitura reputacional|an[aá]lise tem[aá]tica|riscos reputacionais|oportunidades de posicionamento|recomenda[cç][oõ]es executivas|cen[aá]rios prospectivos|demonstra[cç][aã]o dos servi[cç]os|base qualificada|anexo monitorado|agenda editorial|instru[cç][oõ]es)/i.test(
          line.replace(/^\d+(?:\.\d+)*[.)\s-]*/, '')
        )
    )
}

function signals(text: string) {
  const normalized = normalizeText(text)
  const regulations = text.match(REGULATORY_RE) || []
  const terms = STRATEGIC_TERMS.filter((term) => normalized.includes(normalizeText(term)))
  return unique([...regulations, ...terms, ...headings(text)])
}

function difference(source: string[], targetText: string) {
  const normalizedTarget = normalizeText(targetText)
  return source.filter((value) => !normalizedTarget.includes(normalizeText(value))).slice(0, 30)
}

function metricLines(text: string) {
  return unique(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /(?:reuni[oõ]es|orienta[cç][oõ]es|imprensa|men[cç][oõ]es diretas?)\s*[:|—-]\s*\d+/i.test(line))
  )
}

function factualStatements(text: string) {
  return unique(
    text
      .replace(/\r/g, '')
      .split(/(?<=[.!?])\s+|\n+/)
      .map((line) => line.replace(/^#{1,6}\s*/, '').trim())
      .filter((line) => line.length >= 35 && line.length <= 500)
      .filter((line) =>
        /\b(?:decreto|lei|resolu[cç][aã]o|portaria|pdl|adi|stf|congresso|senado|c[aâ]mara|anm|aneel|ons|ccee)\b|\b\d+(?:[.,]\d+)?\s*(?:%|milh[oõ]es?|bilh[oõ]es?|dias?|empresas?|fontes?|mat[eé]rias?)\b|R\$|US\$/i.test(line)
      )
  ).slice(0, 40)
}

function presentSignals(text: string, candidates: string[]) {
  const normalized = normalizeText(text)
  return candidates.filter((signal) => normalized.includes(normalizeText(signal)))
}

export function compareDeliveredReport(input: {
  referenceTitle: string
  deliveredText: string
  generatedText: string
  leadTitle?: string | null
  packageBaseVersion?: number | null
}): DeliveryComparisonSummary {
  const deliveredSignals = signals(input.deliveredText)
  const generatedSignals = signals(input.generatedText)
  const addedTopics = difference(deliveredSignals, input.generatedText)
  const missingInReference = difference(generatedSignals, input.deliveredText)
  const factualClaimsWithoutBase = difference(factualStatements(input.deliveredText), input.generatedText)
  const narrativeSignalsAdded = difference(
    presentSignals(input.deliveredText, NARRATIVE_SIGNALS),
    input.generatedText
  )
  const visualSignalsAdded = difference(
    presentSignals(input.deliveredText, VISUAL_SIGNALS),
    input.generatedText
  )
  const leadChanged = Boolean(
    input.leadTitle && !normalizeText(input.deliveredText).includes(normalizeText(input.leadTitle))
  )
  const placeholders = input.deliveredText.match(PLACEHOLDER_RE) || []
  const notes: string[] = []
  if (addedTopics.length) notes.push('O relatório entregue contém temas que não estavam no pacote do CORTEX.')
  if (factualClaimsWithoutBase.length) notes.push('Há afirmações factuais na entrega sem correspondência textual no pacote de origem; elas exigem conferência humana antes de virar memória.')
  if (leadChanged) notes.push('A matéria principal do pacote não foi localizada no texto extraído da entrega.')
  if (placeholders.length) notes.push('A entrega ainda contém campos editoriais pendentes.')
  return {
    reference_title: input.referenceTitle,
    added_topics: addedTopics,
    factual_claims_without_base: factualClaimsWithoutBase,
    narrative_signals_added: narrativeSignalsAdded,
    visual_signals_added: visualSignalsAdded,
    missing_in_reference: missingInReference,
    added_metrics: difference(metricLines(input.deliveredText), input.generatedText),
    remaining_placeholders: unique(placeholders),
    lead_changed: leadChanged,
    package_base_version: input.packageBaseVersion || null,
    notes,
  }
}

function generatedDraftText(
  sections: ReportSection[],
  evidence: ReportEvidenceItem[]
) {
  return [
    ...sections.sort((a, b) => a.section_key - b.section_key).map((section) => section.content),
    buildQualifiedSection(evidence),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export async function compareReferenceToDraft(
  supabase: SupabaseClient,
  draftId: string,
  referenceReportId: string
) {
  const [
    { data: draft, error: draftError },
    { data: reference, error: referenceError },
    { data: sections },
    evidence,
    { data: packageExport },
    { data: diagnosticReference },
  ] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*').eq('id', draftId).single(),
    supabase.from('reference_reports').select('*').eq('id', referenceReportId).single(),
    supabase.from('report_sections').select('*').eq('draft_id', draftId).order('section_key'),
    reportEvidenceItems(supabase, draftId),
    supabase
      .from('report_package_exports')
      .select('*')
      .eq('draft_id', draftId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reference_reports')
      .select('id, extracted_text, metadata')
      .eq('draft_id', draftId)
      .eq('reference_kind', 'diagnostic_package')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (draftError || !draft) throw new Error(draftError?.message || 'Preparação não encontrada.')
  if (referenceError || !reference) throw new Error(referenceError?.message || 'Relatório de referência não encontrado.')
  const summary = compareDeliveredReport({
    referenceTitle: reference.title,
    deliveredText: reference.extracted_text || '',
    generatedText:
      diagnosticReference?.extracted_text ||
      generatedDraftText((sections || []) as ReportSection[], evidence),
    leadTitle:
      evidence.find((item) => item.article_id === draft.lead_article_id)?.article_snapshot.title || null,
    packageBaseVersion:
      packageExport?.base_version ||
      Number((diagnosticReference?.metadata as Record<string, unknown> | null)?.base_version || 0) ||
      null,
  })
  const { data: comparison, error } = await supabase
    .from('reference_report_comparisons')
    .upsert(
      {
        draft_id: draftId,
        reference_report_id: referenceReportId,
        diagnostic_reference_report_id: diagnosticReference?.id || null,
        package_export_id: packageExport?.id || null,
        status: 'review',
        summary,
        compared_at: new Date().toISOString(),
      },
      { onConflict: 'draft_id,reference_report_id' }
    )
    .select()
    .single()
  if (error || !comparison) throw new Error(error?.message || 'Falha ao comparar a entrega.')

  await supabase
    .from('report_memory_suggestions')
    .delete()
    .eq('comparison_id', comparison.id)
    .eq('status', 'pending')
  const suggestions: Array<{
    comparison_id: string
    client_id: string
    category: DirectiveCategory
    title: string
    suggestion: string
    evidence: Record<string, unknown>
  }> = summary.added_topics.map((topic) => ({
    comparison_id: comparison.id,
    client_id: draft.client_id,
    category: 'captacao',
    title: `Tema acrescentado na entrega: ${topic}`,
    suggestion: `Avaliar a inclusão permanente ou mensal de “${topic}” nas consultas e na agenda editorial do cliente.`,
    evidence: { topic, reference_report_id: referenceReportId },
  }))
  if (summary.remaining_placeholders.length) {
    suggestions.push({
      comparison_id: comparison.id,
      client_id: draft.client_id,
      category: 'metrica',
      title: 'Impedir placeholders na entrega',
      suggestion: 'Exigir confirmação dos indicadores de serviço antes do pacote final e da aprovação.',
      evidence: { placeholders: summary.remaining_placeholders },
    })
  }
  if (suggestions.length) {
    const { error: suggestionError } = await supabase.from('report_memory_suggestions').insert(suggestions)
    if (suggestionError) throw new Error(suggestionError.message)
  }
  return { comparison, suggestions }
}
