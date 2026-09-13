import { describe, expect, it } from 'vitest'
import { describeWhyNoReports, type DraftSummary } from './reports-diagnostics'

const draft = (status: DraftSummary['status'], extra: Partial<DraftSummary> = {}): DraftSummary => ({
  id: `d-${status}`,
  status,
  period_month: '2026-08-01',
  client_id: 'c1',
  clients: { name: 'ANTAQ' },
  ...extra,
})

describe('describeWhyNoReports', () => {
  it('sem preparação nenhuma, manda começar uma', () => {
    const d = describeWhyNoReports([])
    expect(d.headline).toMatch(/Nenhum relatório e nenhuma preparação/)
    expect(d.cta?.href).toBe('/reports/prepare')
  })

  it('com preparações em andamento, diz quantas e em que estado', () => {
    const d = describeWhyNoReports([draft('preparing'), draft('preparing', { id: 'd2' }), draft('review')])
    expect(d.headline).toMatch(/3 preparação\(ões\) em andamento/)
    // Plural correto e ordenado do mais avançado para o menos
    expect(d.detail).toContain('1 em revisão')
    expect(d.detail).toContain('2 em preparação')
  })

  it('aponta para o rascunho MAIS avançado', () => {
    const d = describeWhyNoReports([
      draft('preparing', { id: 'atrasado' }),
      draft('review', { id: 'avancado' }),
      draft('triaging', { id: 'meio' }),
    ])
    expect(d.cta?.href).toBe('/reports/prepare?draft=avancado')
    expect(d.cta?.label).toContain('ANTAQ')
    expect(d.cta?.label).toContain('2026-08')
  })

  it('preparação aprovada sem relatório é sinalizada como defeito, não como estado normal', () => {
    // É o único caso em que a lista vazia significa bug de verdade.
    const d = describeWhyNoReports([draft('approved')])
    expect(d.headline).toMatch(/aprovada sem relatório correspondente/)
    expect(d.detail).toMatch(/defeito/)
  })

  it('usa singular com uma preparação só', () => {
    expect(describeWhyNoReports([draft('stale')]).detail).toContain('1 obsoleta')
  })

  it('não quebra sem nome de cliente', () => {
    const d = describeWhyNoReports([draft('review', { clients: null })])
    expect(d.cta?.label).toBe('Continuar 2026-08')
  })
})
