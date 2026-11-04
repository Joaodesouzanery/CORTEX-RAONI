import { describe, expect, it } from 'vitest'
import { saoPauloDayBounds, splitClipping } from './clipping'

const row = (id: string, cita: boolean, status: string) => ({
  article_id: id,
  cita_cliente: cita,
  monitoring_status: status,
  tema: null,
  articles: { title: id, url: `https://x.com/${id}`, resolved_url: null, publisher: 'X', published_at: '2026-11-03T12:00:00Z', content_status: 'integral' },
})

describe('splitClipping', () => {
  it('separa Cliente e Setor e deixa revisão de fora', () => {
    const result = splitClipping([row('a', true, 'confirmado'), row('b', false, 'candidato'), row('c', false, 'revisao')])
    expect(result.client.map((item) => item.id)).toEqual(['a'])
    expect(result.sector.map((item) => item.id)).toEqual(['b'])
  })
})

describe('saoPauloDayBounds', () => {
  it('usa meia-noite de Brasília', () => {
    expect(saoPauloDayBounds('2026-11-03')).toEqual({ start: '2026-11-03T03:00:00.000Z', end: '2026-11-04T03:00:00.000Z' })
  })
})
