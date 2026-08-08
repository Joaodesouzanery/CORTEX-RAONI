import { describe, expect, it } from 'vitest'
import {
  approvalChecklist,
  buildReportClusters,
  comparePeriods,
  diffReportBase,
  exceptionPriority,
  leadSuggestions,
  reportBaseDigest,
} from './report-automation-core'
import type { MonthlyReportDraft, ReportEvidenceItem, ReportSection } from '@/types'
import { previousPeriod, saoPauloPeriod } from './report-automation'

function item(
  id: string,
  title: string,
  classification: Record<string, unknown> = {},
  bucket: ReportEvidenceItem['bucket'] = 'annex'
): ReportEvidenceItem {
  return {
    id,
    draft_id: 'draft',
    article_id: id,
    bucket,
    position: 1,
    article_snapshot: {
      id,
      title,
      url: `https://example.com/${id}`,
      image_url: null,
      excerpt: title,
      content: `${title} `.repeat(20),
      content_status: 'integral',
      author: null,
      published_at: '2026-07-20T12:00:00Z',
      publisher: id === 'b' ? 'Veículo B' : 'Veículo A',
      source_name: 'Fonte',
      source_categoria: 'imprensa',
    },
    classification_snapshot: {
      report_role: bucket === 'qualified' ? 'evidencia' : 'contexto',
      report_role_source: 'ia',
      triaged_at: '2026-07-30T12:00:00Z',
      editorial_review_state: 'automatico',
      editorial_confidence: 0.9,
      editorial_score: 70,
      relevancia: 'alta',
      tom: 'neutro',
      ...classification,
    },
    cluster_key: null,
    created_at: '2026-07-30T12:00:00Z',
  }
}

describe('continuous report automation', () => {
  it('blocks a final package when the base has no verified evidence', () => {
    const draft = {
      id: 'draft',
      base_version: 3,
      base_digest: 'digest',
      lead_article_id: null,
      final_package_base_version: null,
    } as MonthlyReportDraft
    const reportSections = Array.from({ length: 9 }, (_, index) => ({
      section_key: index + 1,
      status: 'generated',
      content: `Seção ${index + 1} revisada.`,
    })) as ReportSection[]
    const checklist = approvalChecklist({
      draft,
      items: [item('a', 'Notícia ainda não triada', { triaged_at: null, report_role_source: null })],
      sections: reportSections,
      unresolvedExceptions: 1,
      uncoveredRequiredTopics: 1,
      invalidCitations: 0,
      comparisonReady: true,
      qualifiedCount: 0,
      unverifiedQualified: 0,
      placeholders: 0,
      serviceMetricsReady: false,
      qualityReady: false,
      requirePackage: false,
    })
    expect(checklist.ready).toBe(false)
    expect(checklist.items.find((entry) => entry.key === 'evidence')?.status).toBe('blocked')
  })

  it('blocks the SINDINFOR-style handoff with untriaged candidates and no evidence', () => {
    const draft = {
      id: 'draft',
      base_version: 3,
      base_digest: 'digest',
      lead_article_id: null,
    } as MonthlyReportDraft
    const sections = Array.from({ length: 9 }, (_, index) => ({
      section_key: index + 1,
      status: 'generated',
      content: `Seção ${index + 1} revisada.`,
    })) as ReportSection[]
    const candidates = Array.from({ length: 125 }, (_, index) =>
      item(String(index), `Candidata ${index}`, { triaged_at: null, report_role_source: null })
    )
    const checklist = approvalChecklist({
      draft,
      items: candidates,
      sections,
      unresolvedExceptions: 125,
      uncoveredRequiredTopics: 1,
      invalidCitations: 0,
      comparisonReady: true,
      qualifiedCount: 0,
      unverifiedQualified: 0,
      placeholders: 0,
      serviceMetricsReady: true,
      qualityReady: false,
      requirePackage: false,
    })
    expect(checklist.ready).toBe(false)
    expect(checklist.items.find((entry) => entry.key === 'triage')?.detail).toContain('125')
    expect(checklist.items.find((entry) => entry.key === 'agenda')?.status).toBe('blocked')
    expect(checklist.items.find((entry) => entry.key === 'lead')?.status).toBe('blocked')
  })

  it('blocks unresolved placeholders such as the CCEE delivery marker', () => {
    const checklist = approvalChecklist({
      draft: {
        id: 'draft',
        base_version: 1,
        base_digest: 'digest',
        lead_article_id: 'a',
      } as MonthlyReportDraft,
      items: [item('a', 'Evidência verificada', {
        verification_status: 'verificada',
        qa_checked_at: '2026-07-31T12:00:00Z',
      }, 'qualified')],
      sections: Array.from({ length: 9 }, (_, index) => ({
        section_key: index + 1,
        status: 'generated',
        content: `Seção ${index + 1} revisada.`,
      })) as ReportSection[],
      unresolvedExceptions: 0,
      uncoveredRequiredTopics: 0,
      invalidCitations: 0,
      comparisonReady: true,
      qualifiedCount: 1,
      unverifiedQualified: 0,
      placeholders: 1,
      serviceMetricsReady: true,
      qualityReady: true,
      requirePackage: false,
    })
    expect(checklist.items.find((entry) => entry.key === 'placeholders')?.status).toBe('blocked')
  })

  it('uses the São Paulo month boundary and handles January', () => {
    expect(saoPauloPeriod(new Date('2026-08-01T02:59:59Z'))).toBe('2026-07')
    expect(saoPauloPeriod(new Date('2026-08-01T03:00:00Z'))).toBe('2026-08')
    expect(previousPeriod('2026-01')).toBe('2025-12')
  })

  it('keeps the base digest stable across ordering and ignores snapshot ids', () => {
    const first = item('a', 'Minerais críticos ganham política nacional')
    const second = item('b', 'Mineração sustentável avança no Pará')
    expect(reportBaseDigest([first, second])).toBe(reportBaseDigest([{ ...second, id: 'changed' }, first]))
  })

  it('records additions, removals and bucket changes independently', () => {
    const before = [item('a', 'Pauta A'), item('b', 'Pauta B')]
    const after = [item('a', 'Pauta A', {}, 'qualified'), item('c', 'Pauta C')]
    const delta = diffReportBase(before, after)
    expect(delta.added.map((row) => row.article_id)).toEqual(['c'])
    expect(delta.removed.map((row) => row.article_id)).toEqual(['b'])
    expect(delta.bucket_changes).toHaveLength(1)
    expect(delta.content_changed).toHaveLength(0)
  })

  it('groups the same pauta from distinct vehicles but preserves both articles', () => {
    const rows = [
      item('a', 'Governo lança política nacional para minerais críticos'),
      item('b', 'Política nacional para minerais críticos é lançada pelo governo'),
    ]
    const clusters = buildReportClusters('draft', rows)
    expect(clusters).toHaveLength(1)
    expect(clusters[0]).toMatchObject({ article_count: 2, vehicle_count: 2 })
    expect(clusters[0].article_ids.sort()).toEqual(['a', 'b'])
  })

  it('prioritizes manual, direct and critical exceptions', () => {
    expect(exceptionPriority(item('a', 'Enviada', { manual_intake: true }))).toBe(1)
    expect(exceptionPriority(item('b', 'Direta', { cita_cliente: true }))).toBe(1)
    expect(exceptionPriority(item('c', 'Crítica', { tom: 'critico' }))).toBe(1)
  })

  it('suggests three leads without selecting one', () => {
    const rows = Array.from({ length: 5 }, (_, index) =>
      item(String(index), `Pauta estratégica número ${index}`, { cita_cliente: index === 4 }, 'qualified')
    )
    const clusters = buildReportClusters('draft', rows)
    const suggestions = leadSuggestions('draft', 3, rows, clusters)
    expect(suggestions).toHaveLength(3)
    expect(suggestions[0].article_id).toBe('4')
    expect(suggestions.map((suggestion) => suggestion.rank)).toEqual([1, 2, 3])
  })

  it('compares new, recurring and absent themes month over month', () => {
    const current = [item('a', 'A', { tema: 'Minerais críticos' }), item('b', 'B', { tema: 'Pará' })]
    const previous = [item('c', 'C', { tema: 'Pará' }), item('d', 'D', { tema: 'CFEM' })]
    const result = comparePeriods('2026-07', current, '2026-06', previous)
    expect(result.themes_new).toEqual(['Minerais críticos'])
    expect(result.themes_recurring).toEqual(['Pará'])
    expect(result.themes_absent).toEqual(['CFEM'])
  })
})
