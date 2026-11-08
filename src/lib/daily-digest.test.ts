import { describe, expect, it } from 'vitest'
import { buildDailyDigest, digestText } from './daily-digest'

const row = (id: string, title: string, publisher: string, cita = false, tom: 'positivo' | 'neutro' | 'negativo' = 'neutro') => ({
  article_id: id, cita_cliente: cita, monitoring_status: 'confirmado', tom,
  articles: { title, url: `https://x.com/${id}`, resolved_url: null, publisher, published_at: '2026-10-22T10:00:00Z' },
})

describe('buildDailyDigest', () => {
  it('junta o mesmo fato de vários veículos e separa cliente de setor', () => {
    const digest = buildDailyDigest('2026-10-22', [
      row('1', 'ONS premia 24 agentes por desempenho na operação do SIN', 'Brasil Energia', true),
      row('2', 'ONS premia 24 agentes por desempenho na operação do sistema elétrico', 'Agência Infra', true, 'positivo'),
      row('3', 'Leilão de transmissão pode girar R$ 8,9 bi', 'Valor'),
    ])
    expect(digest.client).toHaveLength(1)
    expect(digest.client[0].publishers).toEqual(['Brasil Energia', 'Agência Infra'])
    expect(digest.sector).toHaveLength(1)
    const text = digestText('ONS', digest)
    expect(text).not.toContain('Tom: pendente')
    expect(text).toContain('desempenho na operação do SIN". A menção foi positiva.')
    // Setor não leva tom, como no clipping que a ONS recebe.
    expect(text).toContain('Valor publicou: "Leilão de transmissão pode girar R$ 8,9 bi". https://x.com/3')
  })
})
