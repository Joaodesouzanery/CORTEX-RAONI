import { describe, expect, it } from 'vitest'
import { buildBackfillQueries } from './backfill'

describe('consultas do backfill de mês', () => {
  const clients = [
    { id: '1', name: 'ONS', directTerms: ['ONS', 'Operador Nacional do Sistema Elétrico', 'Márcio Rea'], themeTerms: ['curtailment', 'leilão de baterias', 'LRCAP', 'operação'] },
  ]
  const queries = buildBackfillQueries(clients, '2026-10')

  it('janela do mês com after/before exclusivos', () => {
    const q = decodeURIComponent(queries[0].url)
    expect(q).toContain('after:2026-09-30 before:2026-11-01')
  })

  it('termo direto e frase de tema entram; palavra solta de tema não', () => {
    const terms = queries.flatMap((query) => query.terms)
    expect(terms).toEqual(expect.arrayContaining(['ONS', 'Márcio Rea', 'leilão de baterias', 'LRCAP']))
    expect(terms).not.toContain('curtailment')
    expect(terms).not.toContain('operação')
    expect(decodeURIComponent(queries[0].url)).toContain('"Operador Nacional do Sistema Elétrico"')
  })

  it('é determinística (o cursor anda sobre a mesma lista)', () => {
    expect(buildBackfillQueries(clients, '2026-10').map((q) => q.url)).toEqual(queries.map((q) => q.url))
  })
})
