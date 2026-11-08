import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { reportEvidenceItems } from '@/lib/report-drafts'
import { evidenceCitations } from '@/lib/report-quality'
import { REPORT_SECTION_GROUPS } from '@/lib/report-sections'
import { buildSystemPrompt } from '@/lib/ai/claude'
import { buildDcHtml, buildDesignPackage, lintPlaybook, type DcEvidence } from '@/lib/report-dc-html'
import { safeExternalUrl } from '@/lib/url'
import { REPORT_ITEMS, selectReportItems } from '@/lib/report-selection'
import { buildHighlights, highlightsMarkdown, type HighlightTheme } from '@/lib/report-highlights'
import { buildClippingDays, clippingMarkdown } from '@/lib/clipping-text'
import { buildDesignPrompt } from '@/lib/design-prompt'
import type { ReportEvidenceItem, Tom } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Rótulo do tom na Base de evidências (o template mostra a palavra, não o código).
const TONE_LABEL: Record<string, string> = { positivo: 'Positivo', neutro: 'Neutro', negativo: 'Negativo', critico: 'Negativo' }

// Nomes que nunca podem sair no relatório do cliente (playbook, seção 3).
const FORBIDDEN_NAMES: Record<string, string[]> = { PRIO: ['PetroRecôncavo'] }

function termsOf(groups: unknown): string[] {
  return Array.isArray(groups) ? groups.flatMap((group) => (Array.isArray(group) ? group.filter((term): term is string => typeof term === 'string') : [])) : []
}

// Pública como as demais rotas de relatório (interface sem login): devolve o
// rascunho do cliente no template A4 (?format=html) ou o pacote para o Claude
// Design (?format=md). Só leitura; não gasta token: destaques e clipping são
// determinísticos (src/lib/report-highlights.ts, src/lib/clipping-text.ts).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = new URL(req.url).searchParams.get('format') === 'md' ? 'md' : 'html'
  const supabase = createAdminClient()
  const [{ data: draft, error }, items, { data: sections, error: sectionsError }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(*)').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('report_sections').select('section_key, content').eq('draft_id', id).order('section_key'),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Rascunho não encontrado.' }, { status: 404 })
  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  const client = draft.clients as { id: string; name: string; contratante?: string | null; report_prompt?: string | null; sector?: string | null; context?: string | null }
  const [profileResult, rulesResult, themesResult] = await Promise.all([
    supabase.from('client_report_profiles').select('brand, display_name, format, location, min_items').eq('client_id', client.id).maybeSingle(),
    supabase.from('client_relevance_rules').select('match_type, required_groups, excluded_terms').eq('client_id', client.id).eq('active', true),
    supabase.from('client_report_topic_templates').select('title, inclusion_terms, exclusion_terms').eq('client_id', client.id).eq('active', true).order('position'),
  ])
  if (profileResult.error) return NextResponse.json({ error: `Perfil do cliente indisponível (${profileResult.error.code}). Aplique a migration 051.` }, { status: 500 })
  if (rulesResult.error) return NextResponse.json({ error: `Regras do cliente indisponíveis (${rulesResult.error.code}).` }, { status: 500 })
  if (themesResult.error) return NextResponse.json({ error: `Temas do cliente indisponíveis (${themesResult.error.code}).` }, { status: 500 })
  const profile = profileResult.data

  const period = String(draft.period_month).slice(0, 7)
  const periodLabelRaw = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-15T12:00:00Z`))
  const periodLabel = periodLabelRaw.charAt(0).toUpperCase() + periodLabelRaw.slice(1)
  const byArticle = new Map(items.map((item) => [item.article_id, item]))
  const toneOf = (articleId: string) => ((byArticle.get(articleId)?.classification_snapshot || {}) as Record<string, unknown>).tom as Tom | null
  const toneLabel = (articleId: string) => {
    const tone = toneOf(articleId)
    return tone ? TONE_LABEL[tone] || tone : null
  }
  const writtenSections = (sections || []).filter((section) => section.content?.trim())
  const limit = Number(profile?.min_items) > 0 ? Number(profile?.min_items) : REPORT_ITEMS

  let chosen: string[] = []
  let evidence: DcEvidence[] = evidenceCitations(items).map((citation) => {
    const item = byArticle.get(citation.article_id)
    const snapshot = item?.article_snapshot
    const classification = (item?.classification_snapshot || {}) as Record<string, unknown>
    chosen.push(citation.article_id)
    return {
      code: citation.code,
      date: citation.published_at,
      outlet: citation.publisher,
      title: citation.title,
      url: safeExternalUrl(snapshot?.url || null),
      tone: toneLabel(citation.article_id),
      weak: snapshot?.content_status !== 'integral' || classification.match_strength === 'fraco',
    }
  })
  // A seleção determinística é o caminho principal (08/11/2026): só link
  // exato, só o mês, cliente primeiro, grandes veículos, sem repetir pauta.
  // As citações da IA só ficam quando as seções já foram escritas com elas —
  // trocar a base ali quebraria os códigos [E###] do texto.
  let selectionNote: string | null = null
  if (!writtenSections.length || evidence.length < limit) {
    const rules = rulesResult.data || []
    const clientTerms = rules.filter((rule) => rule.match_type === 'direta').flatMap((rule) => termsOf(rule.required_groups))
    const excludeTerms = [
      ...(FORBIDDEN_NAMES[client.name] || []),
      ...rules.filter((rule) => rule.match_type !== 'direta').flatMap((rule) => (Array.isArray(rule.excluded_terms) ? rule.excluded_terms : [])),
    ]
    const candidates = items
      .filter((item) => item.bucket !== 'excluded')
      .map((item) => ({
        id: item.article_id,
        title: item.article_snapshot.title,
        url: item.article_snapshot.url,
        outlet: item.article_snapshot.publisher || item.article_snapshot.source_name,
        published_at: item.article_snapshot.published_at,
        cites_client: item.classification_snapshot.cita_cliente === true,
        score: Number(item.classification_snapshot.editorial_score) || 0,
      }))
    const result = selectReportItems(candidates, { period, clientTerms, excludeTerms: Array.from(new Set(excludeTerms)), limit })
    chosen = result.selected.map((item) => item.id)
    evidence = result.selected.map((item, index) => ({
      code: `E${String(index + 1).padStart(3, '0')}`,
      date: item.published_at,
      outlet: item.outlet || 'Veículo não identificado',
      title: item.title,
      url: safeExternalUrl(item.url),
      tone: toneLabel(item.id),
      weak: byArticle.get(item.id)?.article_snapshot.content_status !== 'integral',
    }))
    const clientCount = result.selected.filter((item) => item.block === 'Cliente').length
    selectionNote = `Seleção automática: ${result.selected.length} de ${candidates.length} matérias do mês (${clientCount} citam o cliente, ${result.selected.length - clientCount} de setor; ${result.rejected.length} recusadas: link do Google News, id curto, fora do mês, termo excluído ou pauta repetida).${result.missing ? ` Faltaram ${result.missing} para ${limit}: não completar com item fraco.` : ''}`
  }

  const monthItems = items.filter((item) => item.bucket !== 'excluded')
  const toHighlightItem = (item: ReportEvidenceItem) => ({
    id: item.article_id,
    title: item.article_snapshot.title,
    excerpt: item.article_snapshot.excerpt,
    url: item.article_snapshot.url,
    outlet: item.article_snapshot.publisher || item.article_snapshot.source_name || 'Veículo não identificado',
    published_at: item.article_snapshot.published_at,
    cites_client: item.classification_snapshot.cita_cliente === true,
  })
  const themes: HighlightTheme[] = (themesResult.data || []).map((theme) => ({
    title: theme.title,
    inclusion_terms: Array.isArray(theme.inclusion_terms) ? theme.inclusion_terms : [],
    exclusion_terms: Array.isArray(theme.exclusion_terms) ? theme.exclusion_terms : [],
  }))
  const highlights = highlightsMarkdown(buildHighlights(monthItems.map(toHighlightItem), themes), { total: monthItems.length, periodLabel: periodLabel.toLowerCase() })
  const clipping = clippingMarkdown(
    buildClippingDays(
      chosen.flatMap((articleId) => {
        const item = byArticle.get(articleId)
        if (!item) return []
        return [{
          ...toHighlightItem(item),
          tone: toneOf(articleId),
          summary: (item.classification_snapshot.impact_summary as string | null) ?? null,
        }]
      }),
      // No pacote o clipping é das selecionadas: todo item de setor entra.
      { sectorPerDay: limit }
    )
  )

  const input = {
    clientDisplayName: profile?.display_name || client.name,
    brand: profile?.brand || client.contratante || 'CORTEX',
    periodLabel,
    location: profile?.location || null,
    assetBase: '/report-template',
    sections: writtenSections.map((section) => ({ title: REPORT_SECTION_GROUPS[section.section_key - 1]?.label || `Seção ${section.section_key}`, markdown: section.content })),
    evidence,
  }
  const issues = lintPlaybook(input, {
    forbiddenNames: FORBIDDEN_NAMES[client.name] || [],
    period,
    expectedBrand: profile?.brand || undefined,
    maxItems: limit,
  })
  if (selectionNote) issues.unshift({ rule: 'Base de evidências', detail: selectionNote })
  const slug = `${client.name}-${period}`.replace(/[^A-Za-z0-9-]/g, '')
  if (format === 'md') {
    const body = buildDesignPackage(input, issues, {
      designPrompt: buildDesignPrompt({
        clientDisplayName: input.clientDisplayName,
        brand: input.brand,
        periodLabel,
        format: profile?.format,
        location: input.location,
        hasSections: writtenSections.length > 0,
      }),
      // Sem seções escritas (IA desligada), o Claude Design redige: leva o
      // prompt de redação com o mês preenchido — antes saía "não informado".
      masterPrompt: writtenSections.length
        ? null
        : buildSystemPrompt({ mes: periodLabel, reunioes_presenciais: 0, reunioes_virtuais: 0, orientacoes: 0, acoes_imprensa: 0 }, client as never),
      highlights,
      clipping,
    })
    return new NextResponse(body, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}-claude-design.md"` },
    })
  }
  return new NextResponse(buildDcHtml(input), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Playbook-Issues': String(issues.length) },
  })
}
