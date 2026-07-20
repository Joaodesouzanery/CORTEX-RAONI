import { describe, it, expect } from 'vitest'
import { computeAlerts, digestSubject, renderDigestText, hasAlerts, type AlertArticle, type ClientDigest } from './alerts'

function item(over: Partial<AlertArticle> = {}): AlertArticle {
  return { title: over.title ?? 'Título', url: over.url ?? 'https://x/1', veiculo: over.veiculo ?? 'Veículo', published_at: over.published_at ?? '2026-07-18T10:00:00Z', tom: over.tom ?? null, relevancia: over.relevancia ?? null }
}

describe('computeAlerts', () => {
  it('flags a volume spike above baseline × multiplier (and the minimum)', () => {
    const recent = Array.from({ length: 8 }, (_, i) => item({ url: `https://x/${i}` }))
    const alerts = computeAlerts(recent, 2) // spikeFloor = max(6, ceil(2*2)=4) = 6; 8 >= 6
    const spike = alerts.find((a) => a.type === 'pico_volume')
    expect(spike).toBeTruthy()
    expect(spike!.count).toBe(8)
  })

  it('does not flag a spike when volume is within the baseline', () => {
    const recent = Array.from({ length: 5 }, () => item()) // below spikeMinItems (6)
    expect(computeAlerts(recent, 3).some((a) => a.type === 'pico_volume')).toBe(false)
  })

  it('flags negative sentiment at/above the threshold and escalates severity', () => {
    const recent = [item({ tom: 'negativo' }), item({ tom: 'critico' }), item({ tom: 'negativo' })]
    const neg = computeAlerts(recent, 10).find((a) => a.type === 'sentimento_negativo')
    expect(neg).toBeTruthy()
    expect(neg!.count).toBe(3)
    expect(neg!.severity).toBe('media')
    const many = Array.from({ length: 6 }, () => item({ tom: 'negativo' }))
    expect(computeAlerts(many, 10).find((a) => a.type === 'sentimento_negativo')!.severity).toBe('alta')
  })

  it('flags high-relevance items', () => {
    const recent = [item({ relevancia: 'alta' }), item({ relevancia: 'media' })]
    const alta = computeAlerts(recent, 10).find((a) => a.type === 'alta_relevancia')
    expect(alta).toBeTruthy()
    expect(alta!.count).toBe(1)
  })

  it('returns no alerts for a quiet, low-relevance window', () => {
    const recent = [item({ tom: 'neutro', relevancia: 'baixa' })]
    expect(computeAlerts(recent, 10)).toEqual([])
  })

  it('caps attached items to topItems', () => {
    const recent = Array.from({ length: 20 }, (_, i) => item({ url: `https://x/${i}`, relevancia: 'alta' }))
    const alta = computeAlerts(recent, 100).find((a) => a.type === 'alta_relevancia')!
    expect(alta.items.length).toBe(5)
  })
})

describe('digest helpers', () => {
  const digests: ClientDigest[] = [
    { clientName: 'ONS', alerts: computeAlerts([item({ tom: 'negativo' }), item({ tom: 'critico' }), item({ tom: 'negativo' })], 10) },
    { clientName: 'DNIT', alerts: [] },
  ]
  it('hasAlerts is true when any client has alerts', () => {
    expect(hasAlerts(digests)).toBe(true)
    expect(hasAlerts([{ clientName: 'X', alerts: [] }])).toBe(false)
  })
  it('subject counts alerts and clients with alerts', () => {
    const s = digestSubject(digests, 'últimas 24h')
    expect(s).toContain('1 cliente(s)')
    expect(s).toContain('últimas 24h')
  })
  it('text digest lists only clients that have alerts', () => {
    const txt = renderDigestText(digests, 'últimas 24h')
    expect(txt).toContain('## ONS')
    expect(txt).not.toContain('## DNIT')
  })
})
