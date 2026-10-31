import { describe, expect, it } from 'vitest'
import { buildPanelThemes } from './panel-themes'

const row = (id: string, title: string, extra = {}) => ({
  article_id: id,
  monitoring_status: 'candidato',
  cita_cliente: false,
  articles: { title, url: `https://x.com/${id}`, published_at: '2026-09-10' },
  ...extra,
})
const templates = [
  { title: 'Redata', inclusion_terms: ['Redata'], exclusion_terms: [] },
  { title: 'Paracatu', inclusion_terms: ['Paracatu'], exclusion_terms: [] },
]

describe('buildPanelThemes', () => {
  it('mantém tema vazio visível como lacuna e conta o que ficou sem tema', () => {
    const out = buildPanelThemes('2026-09', templates, [row('1', 'Lula sanciona Redata'), row('2', 'Outra pauta')])
    expect(out.total_tagged).toBe(2)
    expect(out.unthemed).toBe(1)
    expect(out.themes[1].articles).toEqual([])
  })

  it('não conta matéria excluída e põe a que cita o cliente primeiro', () => {
    const out = buildPanelThemes('2026-09', templates, [
      row('1', 'Redata avança'),
      row('2', 'Redata: setor comenta', { cita_cliente: true }),
      row('3', 'Redata errado', { monitoring_status: 'excluido' }),
    ])
    expect(out.total_tagged).toBe(2)
    expect(out.themes[0].articles.map((a) => a.id)).toEqual(['2', '1'])
  })

  it('destaque humano vem antes de citação automática', () => {
    const out = buildPanelThemes('2026-09', templates, [
      row('1', 'Redata cita', { cita_cliente: true }),
      row('2', 'Redata curado', { report_role_source: 'humano' }),
    ])
    expect(out.themes[0].articles.map((a) => a.id)).toEqual(['2', '1'])
  })

  it('não entrega href perigoso', () => {
    const out = buildPanelThemes('2026-09', templates, [
      { ...row('1', 'Redata'), articles: { title: 'Redata', url: 'javascript:alert(1)' } },
    ])
    expect(out.themes[0].articles[0].url).toBeNull()
  })
})
