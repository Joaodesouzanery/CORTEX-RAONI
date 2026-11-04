import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { reportEvidenceItems } from '@/lib/report-drafts'
import { evidenceCitations } from '@/lib/report-quality'
import { REPORT_SECTION_GROUPS } from '@/lib/report-sections'
import { buildSystemPrompt } from '@/lib/ai/claude'
import { buildDcHtml, buildDesignPackage, lintPlaybook, type DcEvidence } from '@/lib/report-dc-html'
import { safeExternalUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Pública como as demais rotas de relatório (interface sem login): devolve o
// rascunho do cliente no template A4 (?format=html) ou o pacote para o Claude
// Design (?format=md). Só leitura; não gasta token.
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
  const { data: profile, error: profileError } = await supabase
    .from('client_report_profiles')
    .select('brand, display_name, format, location')
    .eq('client_id', client.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: `Perfil do cliente indisponível (${profileError.code}). Aplique a migration 051.` }, { status: 500 })

  const byArticle = new Map(items.map((item) => [item.article_id, item]))
  const evidence: DcEvidence[] = evidenceCitations(items).map((citation) => {
    const item = byArticle.get(citation.article_id)
    const snapshot = item?.article_snapshot
    const classification = (item?.classification_snapshot || {}) as Record<string, unknown>
    return {
      code: citation.code,
      date: citation.published_at,
      outlet: citation.publisher,
      title: citation.title,
      url: safeExternalUrl((snapshot as { resolved_url?: string | null } | undefined)?.resolved_url || snapshot?.url || null),
      tone: (classification.tom as string | null) ?? null,
      weak: snapshot?.content_status !== 'integral' || classification.match_strength === 'fraco',
    }
  })
  const periodLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(draft.period_month).slice(0, 7)}-15T12:00:00Z`))
  const input = {
    clientDisplayName: profile?.display_name || client.name,
    brand: profile?.brand || client.contratante || 'CORTEX',
    periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
    location: profile?.location || null,
    assetBase: '/report-template',
    sections: (sections || [])
      .filter((section) => section.content?.trim())
      .map((section) => ({ title: REPORT_SECTION_GROUPS[section.section_key - 1]?.label || `Seção ${section.section_key}`, markdown: section.content })),
    evidence,
  }
  const issues = lintPlaybook(input, { forbiddenNames: client.name === 'PRIO' ? ['PetroRecôncavo'] : [] })
  const slug = `${client.name}-${String(draft.period_month).slice(0, 7)}`.replace(/[^A-Za-z0-9-]/g, '')
  if (format === 'md') {
    const body = buildDesignPackage(input, issues, buildSystemPrompt(undefined, client as never))
    return new NextResponse(body, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${slug}-claude-design.md"` },
    })
  }
  return new NextResponse(buildDcHtml(input), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Playbook-Issues': String(issues.length) },
  })
}
