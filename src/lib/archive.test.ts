import { describe, expect, it } from 'vitest'
import {
  canonicalArticleFingerprint,
  cleanArticleText,
  clusterKey,
  inferContentStatus,
  monthBounds,
  sameImportedPublication,
  tomLabel,
} from './archive'

describe('monthly archive helpers', () => {
  it('creates a stable publication fingerprint and keeps different outlets distinct', async () => {
    const a = await canonicalArticleFingerprint({
      title: 'Belo Monte fecha o semestre',
      publisher: 'Valor Econômico',
      published_at: '2026-07-13T10:00:00Z',
    })
    const same = await canonicalArticleFingerprint({
      title: '  Belo Monte fecha o semestre! ',
      publisher: 'Valor Econômico',
      published_at: '2026-07-13T20:00:00Z',
    })
    const otherOutlet = await canonicalArticleFingerprint({
      title: 'Belo Monte fecha o semestre',
      publisher: 'MegaWhat',
      published_at: '2026-07-13T10:00:00Z',
    })
    expect(a).toBe(same)
    expect(otherOutlet).not.toBe(a)
  })

  it('uses calendar-month boundaries for Brasília', () => {
    expect(monthBounds('2026-07')).toEqual({
      month: '2026-07-01',
      start: '2026-07-01T03:00:00.000Z',
      end: '2026-08-01T03:00:00.000Z',
    })
    expect(monthBounds('2018-02').start).toBe('2018-02-01T02:00:00.000Z')
  })

  it('cleans HTML, classifies completeness and maps neutral to technical', () => {
    const body = cleanArticleText('<script>bad()</script><p>Primeiro parágrafo.</p><p>Segundo.</p>')
    expect(body).toContain('Primeiro parágrafo.')
    expect(body).not.toContain('bad')
    expect(inferContentStatus('x'.repeat(700))).toBe('integral')
    expect(inferContentStatus('', 'trecho')).toBe('parcial')
    expect(inferContentStatus('', '')).toBe('metadados')
    expect(tomLabel('neutro')).toBe('técnica')
  })

  it('groups similar titles without deleting publications', () => {
    expect(clusterKey('Temporal derruba torres de transmissão', '2026-07-28')).toBe(
      clusterKey('Temporal derruba torres de transmissão!', '2026-07-28')
    )
  })

  it('does not merge different publications just because headline and day match', () => {
    const base = {
      title: 'Nova regulação do setor elétrico',
      published_at: '2026-07-28T12:00:00.000Z',
    }
    expect(
      sameImportedPublication(
        {
          ...base,
          content:
            'Distribuidoras debatem investimentos tarifas redes consumidores agência consulta pública modernização eficiência qualidade concessões mercado energia segurança operação planejamento expansão integração.',
        },
        {
          ...base,
          content:
            'Pesquisadores analisam formação profissional universidades bolsas ciência laboratórios estudantes inovação produtividade emprego tecnologia educação pública currículo avaliação inclusão.',
        }
      )
    ).toBe(false)
  })
})
