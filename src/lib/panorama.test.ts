import { describe, it, expect } from 'vitest'
import { computePanorama, pct, comparePanoramas, shareOfVoice, type PanoramaRow } from './panorama'

describe('computePanorama', () => {
  it('counts an empty set as all-zero', () => {
    const p = computePanorama([])
    expect(p.total).toBe(0)
    expect(p.tagged).toBe(0)
    expect(p.porTom).toEqual({ positivo: 0, neutro: 0, negativo: 0, critico: 0 })
    expect(p.semTom).toBe(0)
  })

  it('buckets tom, relevância, tipo de fonte and cita-cliente', () => {
    const rows: PanoramaRow[] = [
      { tom: 'positivo', relevancia: 'alta', cita_cliente: true, categoria: 'imprensa' },
      { tom: 'neutro', relevancia: 'media', cita_cliente: false, categoria: 'institucional' },
      { tom: 'negativo', relevancia: 'baixa', cita_cliente: false, categoria: 'agente' },
      { tom: 'critico', relevancia: 'alta', cita_cliente: true, categoria: 'imprensa' },
    ]
    const p = computePanorama(rows)
    expect(p.total).toBe(4)
    expect(p.tagged).toBe(4)
    expect(p.porTom).toEqual({ positivo: 1, neutro: 1, negativo: 1, critico: 1 })
    expect(p.porRelevancia).toEqual({ alta: 2, media: 1, baixa: 1 })
    expect(p.porTipoFonte).toEqual({ imprensa: 2, institucional: 1, agente: 1 })
    expect(p.citamCliente).toBe(2)
    expect(p.sobOutroProtagonista).toBe(2)
    expect(p.semCitacao).toBe(0)
  })

  it('routes untagged dimensions to the "sem …" buckets, not to a guess', () => {
    const rows: PanoramaRow[] = [
      { tom: 'positivo' }, // relevância + cita ausentes
      {}, // totalmente sem tag
    ]
    const p = computePanorama(rows)
    expect(p.total).toBe(2)
    expect(p.tagged).toBe(1) // só o primeiro tem alguma tag
    expect(p.semTom).toBe(1)
    expect(p.semRelevancia).toBe(2)
    expect(p.semCitacao).toBe(2)
    // categoria ausente cai em imprensa (default do banco)
    expect(p.porTipoFonte.imprensa).toBe(2)
  })

  it('treats cita_cliente=false as "sob outro protagonista", not as untagged', () => {
    const p = computePanorama([{ cita_cliente: false }])
    expect(p.sobOutroProtagonista).toBe(1)
    expect(p.semCitacao).toBe(0)
    expect(p.tagged).toBe(1)
  })

  it('pct rounds and guards divide-by-zero', () => {
    expect(pct(93, 234)).toBe(40)
    expect(pct(1, 3)).toBe(33)
    expect(pct(5, 0)).toBe(0)
  })
})

describe('comparePanoramas', () => {
  it('computes deltas and % change vs the previous period', () => {
    const cur = computePanorama([{ tom: 'negativo' }, { tom: 'negativo' }, { tom: 'positivo' }, { relevancia: 'alta' }, { cita_cliente: true }])
    const prev = computePanorama([{ tom: 'negativo' }, { cita_cliente: true }, { cita_cliente: true }])
    const d = comparePanoramas(cur, prev)
    expect(d.totalDelta).toBe(2)
    expect(d.totalPct).toBe(67) // (5-3)/3 → 66.6 rounds to 67
    expect(d.negativoDelta).toBe(1)
    expect(d.positivoDelta).toBe(1)
    expect(d.altaDelta).toBe(1)
    expect(d.citamClienteDelta).toBe(-1)
  })

  it('totalPct is null when the previous period had no items', () => {
    expect(comparePanoramas(computePanorama([{}]), computePanorama([])).totalPct).toBeNull()
  })
})

describe('shareOfVoice', () => {
  it('is the % citing the client among items classified for citation', () => {
    const p = computePanorama([{ cita_cliente: true }, { cita_cliente: true }, { cita_cliente: false }, {}])
    expect(shareOfVoice(p)).toBe(67) // 2 of 3 (untagged excluded)
  })

  it('is null when nothing is classified for citation', () => {
    expect(shareOfVoice(computePanorama([{ tom: 'neutro' }]))).toBeNull()
  })
})
