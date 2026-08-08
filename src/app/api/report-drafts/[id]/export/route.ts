import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import {
  buildAnnex,
  buildDossier,
  buildQualifiedSection,
  evidenceCsv,
  reportEvidenceItems,
} from '@/lib/report-drafts'
import {
  buildMethodologyNote,
  buildMethodologySnapshot,
  buildThematicMatrix,
} from '@/lib/report-quality'
import type { MonthlyReportTopic } from '@/types'
import { createZip } from '@/lib/zip'
import { buildDraftChecklist } from '@/lib/report-automation'
import {
  directivesPrompt,
  lintEditorialDirectives,
  editorialManifest,
  visualBrief,
} from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const format = new URL(req.url).searchParams.get('format') || 'dossier'
  const supabase = createClient()
  const [{ data: draft, error }, items, { data: sections }, { data: topicRows }, { data: topicLinks }] = await Promise.all([
    supabase.from('monthly_report_drafts').select('*, clients(name)').eq('id', id).single(),
    reportEvidenceItems(supabase, id),
    supabase.from('report_sections').select('*').eq('draft_id', id).order('section_key'),
    supabase.from('monthly_report_topics').select('*').eq('draft_id', id).order('position'),
    supabase
      .from('report_topic_evidence')
      .select('*, monthly_report_topics!inner(draft_id)')
      .eq('monthly_report_topics.draft_id', id),
  ])
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Preparação não encontrada.' }, { status: 404 })
  const evidence = items
  const qualifiedSet = new Set(evidence.filter((item) => item.bucket === 'qualified').map((item) => item.article_id))
  const topics = (topicRows || []).map((topic) => ({
    ...topic,
    evidence: (topicLinks || []).filter((link) => link.topic_id === topic.id),
    evidence_count: (topicLinks || []).filter(
      (link) => link.topic_id === topic.id && qualifiedSet.has(link.article_id)
    ).length,
  })) as MonthlyReportTopic[]
  const methodology = buildMethodologySnapshot(evidence)
  const analyticalSections = (sections || []).map((section) =>
    section.section_key === 2
      ? `${section.content}\n\n${buildThematicMatrix(topics, evidence)}`
      : section.content
  )
  const safeName = `${String(draft.clients?.name || 'cliente').replace(/[^a-z0-9]+/gi, '-')}-${draft.period_month.slice(0, 7)}`
  if (format === 'claude-package' || format === 'claude-diagnostic') {
    const packageKind = format === 'claude-diagnostic' ? 'diagnostic' : 'final'
    const [{ data: priorDraft }, checklist] = await Promise.all([
      supabase
        .from('monthly_report_drafts')
        .select('*')
        .eq('client_id', draft.client_id)
        .lt('period_month', draft.period_month)
        .order('approved_at', { ascending: false, nullsFirst: false })
        .order('period_month', { ascending: false })
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle(),
      buildDraftChecklist(supabase, draft, { requirePackage: false }),
    ])
    if (packageKind === 'final' && !checklist.ready) {
      return NextResponse.json(
        {
          error: 'O pacote final só pode ser gerado depois que o checklist estiver pronto.',
          code: 'CLAUDE_PACKAGE_CHECKLIST_BLOCKED',
          checklist,
        },
        { status: 409 }
      )
    }
    const priorSections = priorDraft
      ? (await supabase.from('report_sections').select('*').eq('draft_id', priorDraft.id).order('section_key')).data || []
      : []
    const qualifiedMarkdown = evidence
      .filter((item) => item.bucket === 'qualified')
      .map((item, index) => {
        const code = `E${String(index + 1).padStart(3, '0')}`
        const article = item.article_snapshot
        return [
          `## [${code}] ${article.title}`,
          '',
          `- Veículo: ${article.publisher || article.source_name || 'não identificado'}`,
          `- Data: ${article.published_at || 'sem data'}`,
          `- URL: ${article.url || 'sem URL'}`,
          `- Relevância: ${item.classification_snapshot.relevancia || 'não definida'}`,
          `- Tom: ${item.classification_snapshot.tom || 'não definido'}`,
          `- Justificativa: ${item.classification_snapshot.editorial_reason || '—'}`,
          '',
          article.content || article.excerpt || '_Texto indisponível; consultar a proveniência._',
        ].join('\n')
      })
      .join('\n\n---\n\n')
    const instructions = [
      '# INSTRUÇÕES PARA REVISÃO NO CLAUDE',
      '',
      ...(packageKind === 'diagnostic'
        ? ['> PACOTE DIAGNÓSTICO — BASE INCOMPLETA. NÃO USAR COMO VERSÃO FINAL PARA O CLIENTE.', '']
        : []),
      `Cliente: **${draft.clients?.name || 'cliente'}**`,
      `Competência: **${draft.period_month.slice(0, 7)}**`,
      `Versão da base: **${draft.base_version}**`,
      `Postura narrativa: **${draft.narrative_posture || 'consultivo_cauteloso'}**`,
      '',
      directivesPrompt(draft.applied_editorial_snapshot, ['narrativa', 'terminologia', 'metrica', 'estrutura']),
      '',
      'Use somente as evidências [E001] etc. para afirmações factuais. Preserve a separação entre fato monitorado, leitura estratégica e recomendação. Não invente fontes, números ou compromissos do cliente. A decisão de matéria principal é humana.',
      '',
      `Matéria principal escolhida: ${draft.lead_article_id || 'PENDENTE'}`,
      '',
      '## Checklist do snapshot',
      ...checklist.items.map((item) => `- [${item.status === 'passed' ? 'x' : ' '}] ${item.label}${item.detail ? ` — ${item.detail}` : ''}`),
    ].join('\n')
    const reportText = [
      buildMethodologyNote(methodology, draft.clients?.name || 'cliente', draft.applied_editorial_snapshot || null),
      ...analyticalSections.filter(Boolean),
      buildQualifiedSection(evidence),
    ].join('\n\n')
    const gaps = topics.map((topic) => `- **${topic.title}** — ${topic.coverage_status}${topic.gap_reason ? `: ${topic.gap_reason}` : ''}`).join('\n')
    const comparison = draft.comparison_snapshot && Object.keys(draft.comparison_snapshot).length
      ? JSON.stringify(draft.comparison_snapshot, null, 2)
      : 'Comparação ainda não produzida.'
    const prior = priorDraft
      ? [`# RELATÓRIO ANTERIOR — ${priorDraft.period_month.slice(0, 7)}`, ...priorSections.map((section) => section.content)].join('\n\n')
      : '# RELATÓRIO ANTERIOR\n\nNenhum relatório anterior encontrado.'
    const design = [
      '# BRIEFING PARA O CLAUDE DESIGN',
      '',
      `Marca: ${draft.brand_snapshot?.name || draft.clients?.name || 'cliente'}`,
      `Rodapé: ${draft.brand_snapshot?.footer || '—'}`,
      `Diretrizes: ${draft.brand_snapshot?.guidelines || 'Preservar a identidade visual do relatório anterior.'}`,
      '',
      visualBrief(draft.applied_editorial_snapshot),
      '',
      'A diagramação deve preservar códigos de evidência, hierarquia das seções, nota metodológica e distinção visual entre fato, interpretação e recomendação.',
    ].join('\n')
    const blockedDirectives = lintEditorialDirectives(
      reportText,
      draft.applied_editorial_snapshot || null
    ).filter((check) => check.status === 'blocked')
    if (blockedDirectives.length) {
      return NextResponse.json(
        { error: 'O relatório viola diretivas editoriais do cliente.', checks: blockedDirectives },
        { status: 409 }
      )
    }
    const packageAt = new Date().toISOString()
    const manifest = {
      kind: packageKind,
      client_id: draft.client_id,
      period_month: draft.period_month,
      draft_id: draft.id,
      base_version: draft.base_version,
      base_digest: draft.base_digest,
      evidence_count: evidence.filter((item) => item.bucket === 'qualified').length,
      checklist_ready: checklist.ready,
      generated_at: packageAt,
    }
    const archive = createZip([
      { name: '00_INSTRUCOES.md', content: instructions },
      { name: '01_RASCUNHO_RELATORIO.md', content: reportText },
      { name: '02_EVIDENCIAS_QUALIFICADAS.md', content: qualifiedMarkdown || '# EVIDÊNCIAS QUALIFICADAS\n\nNenhuma evidência qualificada.' },
      { name: '03_ANEXO_MONITORADO.csv', content: `\uFEFF${evidenceCsv(evidence.filter((item) => item.bucket !== 'qualified'))}` },
      { name: '04_AGENDA_E_LACUNAS.md', content: `# AGENDA E LACUNAS\n\n${gaps || 'Nenhum tópico configurado.'}` },
      { name: '05_COMPARACAO_MENSAL.md', content: `# COMPARAÇÃO MENSAL\n\n\`\`\`json\n${comparison}\n\`\`\`` },
      { name: '06_RELATORIO_ANTERIOR.md', content: prior },
      { name: '07_BRIEFING_DESIGN.md', content: design },
      { name: '08_MANIFESTO_EDITORIAL.json', content: editorialManifest(draft.applied_editorial_snapshot) },
      { name: '09_MANIFESTO_DO_PACOTE.json', content: JSON.stringify(manifest, null, 2) },
    ])
    const { data: currentSnapshot } = await supabase
      .from('monthly_report_drafts')
      .select('base_version, base_digest')
      .eq('id', id)
      .single()
    if (
      !currentSnapshot ||
      currentSnapshot.base_version !== draft.base_version ||
      currentSnapshot.base_digest !== draft.base_digest
    ) {
      return NextResponse.json(
        { error: 'A base mudou durante a exportação. Gere o pacote novamente para usar um único snapshot.' },
        { status: 409 }
      )
    }
    const { error: packageError } = await supabase.from('report_package_exports').insert({
      draft_id: draft.id,
      base_version: draft.base_version,
      export_kind: packageKind,
      checklist_snapshot: checklist,
      editorial_snapshot: draft.applied_editorial_snapshot || {},
      manifest,
    })
    if (packageError) {
      return NextResponse.json({ error: packageError.message }, { status: 500 })
    }
    await supabase
      .from('monthly_report_drafts')
      .update(
        packageKind === 'final'
          ? {
              final_package_base_version: draft.base_version,
              final_package_generated_at: packageAt,
              claude_package_base_version: draft.base_version,
              claude_package_generated_at: packageAt,
              updated_at: packageAt,
            }
          : { diagnostic_package_generated_at: packageAt, updated_at: packageAt }
      )
      .eq('id', id)
    return new NextResponse(new Uint8Array(archive), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeName}-pacote-${packageKind}-v${draft.base_version}.zip"`,
        'Cache-Control': 'private, no-store',
      },
    })
  }
  let content: string
  let contentType: string
  let extension: string
  if (format === 'csv') {
    content = evidenceCsv(evidence)
    contentType = 'text/csv; charset=utf-8'
    extension = 'csv'
  } else if (format === 'annex') {
    content = buildAnnex(evidence)
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else if (format === 'text') {
    content = [
      buildMethodologyNote(methodology, draft.clients?.name || 'cliente', draft.applied_editorial_snapshot || null),
      ...analyticalSections.filter(Boolean),
      buildQualifiedSection(evidence),
      '---',
      `*${draft.brand_snapshot?.footer || ''}*`,
    ].join('\n\n')
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  } else {
    content = buildDossier(
      evidence,
      topics,
      draft.clients?.name || 'cliente',
      draft.applied_editorial_snapshot || null
    )
    contentType = 'text/markdown; charset=utf-8'
    extension = 'md'
  }
  return new NextResponse(`\uFEFF${content}`, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeName}-${format}.${extension}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
