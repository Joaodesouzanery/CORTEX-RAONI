import { describe, expect, it } from 'vitest'
import { linkStatus, selectReportItems, type SelectionCandidate } from './report-selection'

const item = (id: string, overrides: Partial<SelectionCandidate> = {}): SelectionCandidate => ({
  id,
  title: `Matéria ${id} sobre leilão de gás número ${id}`,
  url: `https://portalsetorial.com.br/noticias/materia-${id}/`,
  outlet: 'Setorial',
  published_at: '2026-10-10T12:00:00Z',
  ...overrides,
})

describe('linkStatus', () => {
  it('classifica os casos vistos nos relatórios de outubro', () => {
    expect(linkStatus('https://news.google.com/rss/articles/CBMi')).toBe('google_news')
    expect(linkStatus('https://agenciainfra.com/blog/?p=49187')).toBe('id_curto')
    expect(linkStatus('https://ofator.com.br/?p=73692')).toBe('id_curto')
    expect(linkStatus('https://valor.globo.com/')).toBe('secao')
    expect(linkStatus('https://www.cnnbrasil.com.br/economia/')).toBe('secao')
    expect(linkStatus('https://www.cnnbrasil.com.br/infra/prio-eleva-a-1715-milhoes-vendas-barris/')).toBe('exato')
    expect(linkStatus(null)).toBe('ausente')
  })
})

describe('selectReportItems', () => {
  it('rejeita Google News, id curto, fora do mês e termo excluído', () => {
    const result = selectReportItems(
      [
        item('a', { url: 'https://news.google.com/rss/articles/x' }),
        item('b', { url: 'https://agenciainfra.com/blog/?p=1' }),
        item('c', { published_at: '2026-11-01T10:00:00Z' }),
        item('d', { title: 'AGU libera obras de ponte na BR-153 rodovia' }),
        item('e'),
      ],
      { period: '2026-10', excludeTerms: ['rodovia'] }
    )
    expect(result.selected.map((selected) => selected.id)).toEqual(['e'])
    expect(result.rejected).toHaveLength(4)
    expect(result.missing).toBe(19)
  })

  it('põe primeiro o que cita o cliente e depois os grandes veículos', () => {
    const result = selectReportItems(
      [
        item('setor', { title: 'Brent sobe com tensão no Oriente Médio' }),
        item('grande', { title: 'Petróleo fecha em alta', outlet: 'Valor Econômico' }),
        item('cliente', { title: 'PRIO arremata Magnetita e Hematita' }),
      ],
      { period: '2026-10', clientTerms: ['PRIO'] }
    )
    expect(result.selected.map((selected) => selected.id)).toEqual(['cliente', 'grande', 'setor'])
    expect(result.selected[0].block).toBe('Cliente')
  })

  it('não repete a mesma pauta e para em 20', () => {
    const words = ['leilão', 'tarifa', 'dragagem', 'reservatório', 'transmissão', 'bateria', 'curtailment', 'licença', 'cobre', 'terras', 'porto', 'hidrovia', 'diesel', 'brent', 'dividendos', 'câmbio', 'ibovespa', 'data', 'redata', 'tributária', 'anatel', 'cibersegurança', 'startup', 'mineração', 'carajás', 'santarém', 'magnetita', 'hematita', 'wahoo', 'frade']
    const many = words.map((word, index) => item(String(index), { title: `${word} ${word}x ${word}y` }))
    const repeated = [item('x', { title: 'ONS projeta reservatórios do Sudeste em 59,8%' }), item('y', { title: 'ONS projeta reservatórios do Sudeste em 59,8% em novembro' })]
    const result = selectReportItems([...repeated, ...many], { period: '2026-10' })
    expect(result.selected).toHaveLength(20)
    expect(result.selected.filter((selected) => ['x', 'y'].includes(selected.id))).toHaveLength(1)
  })
})
