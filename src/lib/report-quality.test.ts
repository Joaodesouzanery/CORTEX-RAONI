import { describe, expect, it } from 'vitest'
import { buildAgendaSection, deterministicQualityFlags, evaluateReportQuality, inferGeographicScope } from './report-quality'
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
  content: 'Texto',
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

  it('builds the deterministic agenda as section 10', () => {
    expect(buildAgendaSection([topic])).toContain('## 10.')
    expect(buildAgendaSection([topic])).toContain('Mineração no Pará')
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
