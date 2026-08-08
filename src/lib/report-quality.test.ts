import { describe, expect, it } from 'vitest'
import {
  auditReportTraceability,
  buildAgendaSection,
  buildMethodologyNote,
  buildMethodologySnapshot,
  buildThematicMatrix,
  deterministicQualityFlags,
  evaluateReportQuality,
  evidenceCitations,
  inferGeographicScope,
} from './report-quality'
import type { MonthlyReportTopic, ReportEvidenceItem, ReportSection } from '@/types'

function item(
  id: string,
  bucket: ReportEvidenceItem['bucket'],
  classification: Record<string, unknown> = {}
): ReportEvidenceItem {
  return {
    id,
    draft_id: 'draft',
    article_id: id,
    bucket,
    position: 1,
    article_snapshot: {
      id,
      title: id,
      url: `https://example.com/${id}`,
      image_url: null,
      excerpt: 'Mineração responsável no Pará.',
      content: 'Mineração responsável no Pará. '.repeat(30),
      content_status: 'integral',
      author: null,
      published_at: '2026-07-20T12:00:00Z',
      publisher: 'Veículo',
      source_name: 'Veículo',
      source_categoria: 'imprensa',
    },
    classification_snapshot: {
      report_role: bucket === 'qualified' ? 'evidencia' : 'contexto',
      report_role_source: 'ia',
      triaged_at: '2026-07-30T12:00:00Z',
      verification_status: 'verificada',
      editorial_review_state: 'automatico',
      editorial_confidence: 0.96,
      qa_checked_at: '2026-07-30T12:00:00Z',
      source_verification_status: 'fonte_original',
      ...classification,
    },
    cluster_key: null,
    created_at: '2026-07-30T12:00:00Z',
  }
}

const topic: MonthlyReportTopic = {
  id: 'topic',
  draft_id: 'draft',
  position: 1,
  title: 'Mineração no Pará',
  rationale: 'Tema obrigatório',
  inclusion_terms: ['mineração no Pará'],
  exclusion_terms: [],
  required: true,
  coverage_status: 'covered',
  gap_reason: null,
  gap_acknowledged_at: null,
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
  evidence_count: 1,
}

const sections: ReportSection[] = Array.from({ length: 9 }, (_, index) => ({
  id: `section-${index + 1}`,
  draft_id: 'draft',
  section_key: index + 1,
  content: '',
  status: 'generated',
  version: 1,
  generated_at: '2026-07-30T00:00:00Z',
  updated_at: '2026-07-30T00:00:00Z',
}))

describe('report quality gates', () => {
  it('passes only an explicitly triaged and independently verified base', () => {
    const result = evaluateReportQuality({
      items: [item('lead', 'qualified'), item('context', 'annex')],
      topics: [topic],
      sections,
      leadArticleId: 'lead',
      periodMonth: '2026-07-01',
    })
    expect(result.status).toBe('passed')
    expect(result.funnel).toMatchObject({ detected: 2, triaged: 2, qualified: 1 })
  })

  it('blocks untriaged candidates, unverified evidence and cross-period rows', () => {
    const candidate = item('candidate', 'annex', { triaged_at: null, report_role_source: null })
    candidate.article_snapshot.published_at = '2026-06-29T12:00:00Z'
    const proposed = item('proposed', 'qualified', {
      qa_checked_at: null,
      editorial_confidence: 0.7,
    })
    const result = evaluateReportQuality({
      items: [candidate, proposed],
      topics: [topic],
      sections,
      leadArticleId: 'proposed',
      periodMonth: '2026-07-01',
    })
    expect(result.status).toBe('blocked')
    expect(result.checks.find((check) => check.key === 'triage_complete')?.count).toBe(1)
    expect(result.checks.find((check) => check.key === 'qualified_verified')?.count).toBe(1)
    expect(result.checks.find((check) => check.key === 'period_consistent')?.count).toBe(1)
  })

  it('requires human review for direct or critical evidence', () => {
    const direct = item('direct', 'qualified', { cita_cliente: true })
    const result = evaluateReportQuality({
      items: [direct],
      topics: [topic],
      sections,
      leadArticleId: 'direct',
      periodMonth: '2026-07-01',
    })
    expect(result.checks.find((check) => check.key === 'exceptions_reviewed')?.count).toBe(1)
  })

  it('allows regeneration with stale sections but keeps a visible warning', () => {
    const stale = sections.map((section) => ({ ...section, status: 'stale' as const }))
    const result = evaluateReportQuality({
      items: [item('lead', 'qualified')],
      topics: [topic],
      sections: stale,
      leadArticleId: 'lead',
      periodMonth: '2026-07-01',
    })
    expect(result.status).toBe('passed')
    expect(result.checks.find((check) => check.key === 'sections_current')?.status).toBe('warning')
  })

  it('builds the agenda as an internal, unnumbered product', () => {
    expect(buildAgendaSection([topic])).toContain('# AGENDA EDITORIAL INTERNA')
    expect(buildAgendaSection([topic])).not.toContain('## 10.')
    expect(buildAgendaSection([topic])).toContain('Mineração no Pará')
  })

  it('never mistakes the Portuguese preposition para for the state Pará', () => {
    expect(
      inferGeographicScope({
        title: 'Empresa lança ferramenta para organizar equipes',
        excerpt: 'Solução para empresas de tecnologia.',
        content: 'A novidade foi criada para reduzir retrabalho em equipes de software.',
      })
    ).toBe('indeterminado')
    expect(
      inferGeographicScope({
        title: 'Mineração sustentável avança no Pará',
        excerpt: null,
        content: 'O projeto está localizado no Estado do Pará.',
      })
    ).toBe('para')
  })

  it('uses the complete server snapshot in the deterministic method note', () => {
    const items = [
      item('direct', 'qualified', { cita_cliente: true, source_verification_status: 'fonte_original' }),
      item('context', 'annex', {
        source_verification_status: 'nao_verificada',
        editorial_review_state: 'pendente',
      }),
    ]
    items[1].article_snapshot.content_status = 'parcial'
    const snapshot = buildMethodologySnapshot(items)
    expect(snapshot).toMatchObject({
      monitored_total: 2,
      direct_mentions: 1,
      qualified_evidence: 1,
      content_integral: 1,
      content_partial: 1,
      source_original_verified: 1,
      source_unverified: 1,
    })
    expect(buildMethodologyNote(snapshot, 'SIMINERAL')).toContain('2 ocorrências monitoradas no servidor')
  })

  it('blocks uncited facts, invented evidence codes and assertive client mandates', () => {
    const reportSections = sections.map((section) => ({
      ...section,
      content:
        section.section_key === 1
          ? '## 1. SUMÁRIO\n\nEm julho, o SIMINERAL deve liderar 4 agendas. [E999]'
          : '',
    }))
    const checks = auditReportTraceability({
      sections: reportSections,
      citations: evidenceCitations([item('lead', 'qualified')]),
      posture: 'consultivo_cauteloso',
      clientName: 'SIMINERAL',
    })
    expect(checks.find((check) => check.key === 'citation_validity')?.count).toBe(1)
    expect(checks.find((check) => check.key === 'narrative_posture')?.count).toBe(1)
  })

  it('accepts cited facts and keeps the thematic matrix deterministic', () => {
    const reportSections = sections.map((section) => ({
      ...section,
      content:
        section.section_key === 1
          ? '## 1. SUMÁRIO\n\nEm julho, quatro pautas foram monitoradas. [E001]\n\n**Leitura estratégica:** Há oportunidade de aprofundar o tema.'
          : '',
    }))
    const checks = auditReportTraceability({
      sections: reportSections,
      citations: evidenceCitations([item('lead', 'qualified')]),
      posture: 'consultivo_cauteloso',
      clientName: 'SIMINERAL',
    })
    expect(checks.every((check) => check.status === 'passed')).toBe(true)
    const linkedTopic = {
      ...topic,
      evidence: [
        {
          topic_id: topic.id,
          article_id: 'lead',
          source: 'ia' as const,
          confidence: 0.9,
          reason: null,
          human_confirmed: false,
          created_at: '2026-07-30T00:00:00Z',
          updated_at: '2026-07-30T00:00:00Z',
        },
      ],
    }
    expect(buildThematicMatrix([linkedTopic], [item('lead', 'qualified')])).toContain(
      '| Mineração no Pará | 1 | 1 |'
    )
  })
})

describe('SIMINERAL deterministic guards', () => {
  it('recognizes Pará scope and financial/crypto noise', () => {
    const article = {
      title: 'Vale (VALE3) e bitcoin sobem no Pará',
      excerpt: null,
      content: null,
      content_status: 'parcial' as const,
    }
    expect(inferGeographicScope(article)).toBe('para')
    expect(deterministicQualityFlags(article)).toEqual(
      expect.arrayContaining(['texto_insuficiente', 'possivel_mercado_financeiro', 'ambiguidade_criptomoeda'])
    )
  })
})
