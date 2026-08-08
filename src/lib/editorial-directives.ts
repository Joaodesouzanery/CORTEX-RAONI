import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AppliedEditorialSnapshot,
  EditorialDirective,
  MetricVisibility,
  ReportQualityCheckItem,
} from '@/types'
import { normalizeText } from '@/lib/relevance'

function periodDate(period: string) {
  return `${period.slice(0, 7)}-01`
}

// This module is also imported by UI-safe quality helpers. Keep the digest
// portable instead of pulling Node's crypto module into a client bundle.
function stableDigest(value: string) {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    first ^= code
    first = Math.imul(first, 0x01000193)
    second ^= code + index
    second = Math.imul(second, 0x85ebca6b)
  }
  return `${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`
}

export function applicableDirectives(directives: EditorialDirective[], period: string) {
  const month = periodDate(period)
  return directives
    .filter(
      (directive) =>
        directive.active &&
        (directive.scope === 'permanent' || directive.period_month?.slice(0, 10) === month)
    )
    .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
}

export function editorialSnapshot(
  directives: EditorialDirective[],
  period: string,
  profileVersion = 0,
  capturedAt = new Date().toISOString(),
  profile: AppliedEditorialSnapshot['profile'] = null
): AppliedEditorialSnapshot {
  const applied = applicableDirectives(directives, period)
  const stable = applied.map((directive) => {
    const copy = { ...directive } as Partial<EditorialDirective>
    delete copy.updated_at
    delete copy.created_at
    return copy
  })
  const serialized = JSON.stringify({ profileVersion, profile, directives: stable })
  return {
    profile_version: profileVersion,
    profile,
    directives: applied,
    captured_at: capturedAt,
    digest: stableDigest(serialized),
  }
}

export async function loadEditorialSnapshot(
  supabase: SupabaseClient,
  clientId: string,
  period: string
) {
  const [{ data: profile }, { data: directives, error }] = await Promise.all([
    supabase.from('client_editorial_profiles').select('*').eq('client_id', clientId).maybeSingle(),
    supabase
      .from('client_editorial_directives')
      .select('*')
      .eq('client_id', clientId)
      .eq('active', true)
      .order('category')
      .order('title'),
  ])
  if (error) throw new Error(error.message)
  const profileSnapshot = profile
    ? {
        permanent_axes: Array.isArray(profile.permanent_axes) ? profile.permanent_axes.map(String) : [],
        inclusion_guidelines: String(profile.inclusion_guidelines || ''),
        exclusion_guidelines: String(profile.exclusion_guidelines || ''),
        style_guidelines: String(profile.style_guidelines || ''),
        default_posture: profile.default_posture || 'consultivo_cauteloso',
      }
    : null
  return editorialSnapshot(
    (directives || []) as EditorialDirective[],
    period,
    Number(profile?.version || 0),
    new Date().toISOString(),
    profileSnapshot
  )
}

function changedCategories(
  previous: AppliedEditorialSnapshot | null | undefined,
  current: AppliedEditorialSnapshot
) {
  const before = new Map((previous?.directives || []).map((item) => [item.directive_key, JSON.stringify(item)]))
  const after = new Map(current.directives.map((item) => [item.directive_key, JSON.stringify(item)]))
  const categories = new Set<EditorialDirective['category']>()
  if (previous && previous.profile_version !== current.profile_version) {
    categories.add('qualificacao')
    categories.add('narrativa')
  }
  for (const directive of [...(previous?.directives || []), ...current.directives]) {
    if (before.get(directive.directive_key) !== after.get(directive.directive_key)) {
      categories.add(directive.category)
    }
  }
  return categories
}

export async function syncDraftEditorialSnapshot(
  supabase: SupabaseClient,
  draft: {
    id: string
    client_id: string
    period_month: string
    status: string
    applied_editorial_snapshot?: AppliedEditorialSnapshot | null
  }
) {
  if (draft.status === 'approved') return draft.applied_editorial_snapshot || null
  const current = await loadEditorialSnapshot(supabase, draft.client_id, draft.period_month)
  if (current.digest === draft.applied_editorial_snapshot?.digest) return current
  const changed = changedCategories(draft.applied_editorial_snapshot, current)
  const now = new Date().toISOString()
  const textual = ['narrativa', 'terminologia', 'estrutura'].some((category) => changed.has(category as EditorialDirective['category']))
  const metric = changed.has('metrica')
  const qualification = changed.has('captacao') || changed.has('qualificacao')

  const update: Record<string, unknown> = {
    applied_editorial_snapshot: current,
    editorial_snapshot_version: current.profile_version,
    claude_package_base_version: null,
    claude_package_generated_at: null,
    final_package_base_version: null,
    final_package_generated_at: null,
    updated_at: now,
  }
  if (textual || metric || qualification) {
    update.quality_status = 'pending'
    update.quality_checked_at = null
  }
  if (qualification) update.automation_status = 'pending'
  await supabase
    .from('monthly_report_drafts')
    .update(update)
    .eq('id', draft.id)

  if (textual) {
    await supabase
      .from('report_sections')
      .update({ status: 'stale', updated_at: now })
      .eq('draft_id', draft.id)
      .in('status', ['generated', 'edited'])
  }
  if (metric) {
    await supabase
      .from('report_sections')
      .update({ status: 'stale', updated_at: now })
      .eq('draft_id', draft.id)
      .eq('section_key', 2)
      .in('status', ['generated', 'edited'])
  }
  if (qualification) {
    const { data: items } = await supabase
      .from('report_evidence_items')
      .select('article_id')
      .eq('draft_id', draft.id)
    const articleIds = (items || []).map((item) => item.article_id)
    for (let offset = 0; offset < articleIds.length; offset += 300) {
      await supabase
        .from('article_client_tags')
        .update({
          report_role: null,
          editorial_score: null,
          editorial_reason: null,
          report_role_source: null,
          triaged_at: null,
          triage_version: null,
          qa_source: null,
          qa_checked_at: null,
          qualified_at: null,
          qualification_version: null,
        })
        .eq('client_id', draft.client_id)
        .in('article_id', articleIds.slice(offset, offset + 300))
        .or('classification_source.neq.humano,classification_source.is.null')
        .or('report_role_source.neq.humano,report_role_source.is.null')
        .or('editorial_review_state.neq.revisado,editorial_review_state.is.null')
    }
  }
  return current
}

export function directivesPrompt(snapshot?: AppliedEditorialSnapshot | null, categories?: EditorialDirective['category'][]) {
  const directives = (snapshot?.directives || []).filter(
    (directive) => !categories?.length || categories.includes(directive.category)
  )
  const profileLines: string[] = []
  if (categories?.some((category) => category === 'captacao' || category === 'qualificacao')) {
    if (snapshot?.profile?.permanent_axes?.length) profileLines.push(`Eixos permanentes: ${snapshot.profile.permanent_axes.join('; ')}.`)
    if (snapshot?.profile?.inclusion_guidelines) profileLines.push(`Inclusão: ${snapshot.profile.inclusion_guidelines}`)
    if (snapshot?.profile?.exclusion_guidelines) profileLines.push(`Exclusão: ${snapshot.profile.exclusion_guidelines}`)
  }
  if (categories?.some((category) => ['narrativa', 'terminologia', 'estrutura'].includes(category)) && snapshot?.profile?.style_guidelines) {
    profileLines.push(`Postura e linguagem: ${snapshot.profile.style_guidelines}`)
  }
  if (!directives.length && !profileLines.length) return ''
  return [
    'DIRETIVAS HUMANAS E VERSIONADAS DO CLIENTE — cumpra-as na camada indicada:',
    ...profileLines.map((line) => `- [perfil] ${line}`),
    ...directives.map((directive) => {
      const replacements = directive.replacements?.length
        ? ` Alternativas: ${directive.replacements.join('; ')}.`
        : ''
      return `- [${directive.category}/${directive.severity}] ${directive.title}: ${directive.instruction}${replacements}`
    }),
  ].join('\n')
}

export function metricVisibility(
  snapshot: AppliedEditorialSnapshot | null | undefined,
  metricKey: string
): MetricVisibility {
  const match = (snapshot?.directives || []).find(
    (directive) => directive.category === 'metrica' && directive.directive_key.includes(metricKey)
  )
  return match?.metric_visibility || 'publica'
}

export function visualBrief(snapshot?: AppliedEditorialSnapshot | null) {
  const directives = (snapshot?.directives || []).filter((directive) => directive.category === 'visual')
  if (!directives.length) return 'Nenhuma direção visual adicional registrada.'
  return directives
    .map((directive) => {
      const examples = directive.examples || {}
      const queries = Array.isArray(examples.consultas) ? examples.consultas.map(String) : []
      const avoid = Array.isArray(examples.evitar) ? examples.evitar.map(String) : []
      return [
        `## ${directive.title}`,
        directive.instruction,
        queries.length ? `Consultas visuais sugeridas: ${queries.join(' | ')}` : '',
        avoid.length ? `Evitar: ${avoid.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n\n')
}

function phraseIsSupportedQuote(line: string, phrase: string) {
  const hasCitation = /\[E\d{3}\]/i.test(line)
  const hasQuote = /^\s*>/.test(line) || /[“”"«»]/.test(line)
  return hasCitation && hasQuote && normalizeText(line).includes(normalizeText(phrase))
}

export function lintEditorialDirectives(
  text: string,
  snapshot?: AppliedEditorialSnapshot | null
): ReportQualityCheckItem[] {
  const lines = text.split('\n')
  const checks: ReportQualityCheckItem[] = []
  for (const directive of snapshot?.directives || []) {
    if (directive.severity !== 'block') continue
    const details: string[] = []
    if (directive.phrase) {
      for (const line of lines) {
        if (!normalizeText(line).includes(normalizeText(directive.phrase))) continue
        if (directive.allow_literal_quote && phraseIsSupportedQuote(line, directive.phrase)) continue
        details.push(line.trim().slice(0, 300))
      }
    }
    const avoid = Array.isArray(directive.examples?.evitar)
      ? directive.examples.evitar.map(String)
      : []
    for (const expression of avoid) {
      for (const line of lines) {
        if (normalizeText(line).includes(normalizeText(expression))) details.push(line.trim().slice(0, 300))
      }
    }
    if (directive.category === 'metrica' && directive.metric_visibility !== 'publica') {
      for (const line of lines) {
        if (/\b\d+\s+(?:men[cç][oõ]es?|inser[cç][oõ]es?)\s+diretas?\b/i.test(line)) {
          details.push(line.trim().slice(0, 300))
        }
      }
    }
    checks.push({
      key: `directive:${directive.directive_key}`,
      label: directive.title,
      status: details.length ? 'blocked' : 'passed',
      count: details.length,
      details: Array.from(new Set(details)).slice(0, 20),
    })
  }
  return checks
}

export function editorialManifest(snapshot?: AppliedEditorialSnapshot | null) {
  return JSON.stringify(
    {
      digest: snapshot?.digest || null,
      profile_version: snapshot?.profile_version || 0,
      captured_at: snapshot?.captured_at || null,
      profile: snapshot?.profile || null,
      directives: (snapshot?.directives || []).map((directive) => ({
        key: directive.directive_key,
        category: directive.category,
        severity: directive.severity,
        instruction: directive.instruction,
        replacements: directive.replacements,
        metric_visibility: directive.metric_visibility,
        layer_use:
          directive.category === 'captacao' || directive.category === 'qualificacao'
            ? 'contexto da base; não converter em afirmação factual'
            : 'aplicar ao texto ou ao briefing de design',
      })),
    },
    null,
    2
  )
}
