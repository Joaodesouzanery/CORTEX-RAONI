import { describe, expect, it } from 'vitest'
import { buildHighlights, highlightsMarkdown, type HighlightItem } from './report-highlights'

const item = (id: string, title: string, outlet: string, cites = false, url = `https://www.exemplo.com.br/2026/10/${id}-materia`): HighlightItem => ({
  id,
  title,
  outlet,
  url,
  published_at: '2026-10-20T12:00:00Z',
  cites_client: cites,
})

const items = [
  item('1', 'ONS adota operação especial para o segundo turno das eleições', 'Agência Brasil', true),
  item('2', 'Operador planeja operação especial no segundo turno', 'Poder360', true),
  item('3', 'ONS eleva previsão de carga de energia para 4,9%', 'CNN Brasil', true),
  item('4', 'Previsão de carga de energia sobe em outubro', 'MegaWhat'),
  item('5', 'Prêmio ONS de Qualidade na Operação reconhece transmissoras', 'Cenário Energia', true),
  item('6', 'Chuvas recompõem reservatórios e reduzem térmicas', 'O Globo'),
  item('7', 'Reservatórios do Sudeste sobem com chuvas de setembro', 'Valor Econômico'),
  item('8', 'Clube anuncia novo patrocinador', 'G1'),
]

const themes = [
  { title: 'Operação especial no período eleitoral', inclusion_terms: ['operação especial', 'segundo turno'] },
  { title: 'Carga de energia e previsões do operador', inclusion_terms: ['carga de energia'] },
  { title: 'Hidrologia, afluências e reservatórios', inclusion_terms: ['reservatórios'] },
  { title: 'Prêmio ONS, GO15 e liderança', inclusion_terms: ['Prêmio ONS', 'GO15'] },
  { title: 'Tema sem matéria', inclusion_terms: ['inexistente'] },
]

describe('destaques do mês', () => {
  const highlights = buildHighlights(items, themes)

  it('chega aos eixos que a ONS recebeu em outubro, com cliente pesando mais', () => {
    expect(highlights.map((h) => h.title)).toEqual([
      'Operação especial no período eleitoral',
      'Carga de energia e previsões do operador',
      'Prêmio ONS, GO15 e liderança',
      'Hidrologia, afluências e reservatórios',
    ])
    expect(highlights[0]).toMatchObject({ count: 2, client_count: 2, origin: 'tema' })
  })

  it('tema sem matéria não vira eixo (nunca inventar)', () => {
    expect(highlights.some((h) => h.title === 'Tema sem matéria')).toBe(false)
  })

  it('completa com pauta repetida quando os temas não bastam', () => {
    const fromStories = buildHighlights(
      [
        item('a', 'Aneel aprova reajuste da conta de luz em São Paulo', 'Folha'),
        item('b', 'Aneel aprova reajuste da conta de luz em São Paulo hoje', 'G1'),
      ],
      []
    )
    expect(fromStories).toHaveLength(1)
    expect(fromStories[0]).toMatchObject({ origin: 'pauta', count: 2 })
  })

  it('markdown declara denominador e leva só links exatos', () => {
    const md = highlightsMarkdown(
      buildHighlights([item('g', 'Carga de energia sobe', 'CNN', true, 'https://news.google.com/rss/articles/x'), ...items.slice(2, 4)], themes),
      { total: 3, periodLabel: 'outubro de 2026' }
    )
    expect(md).toContain('Contagens sobre 3 matérias de outubro de 2026')
    expect(md).not.toContain('news.google.com')
  })
})
