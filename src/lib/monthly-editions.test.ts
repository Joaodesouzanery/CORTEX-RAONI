import { describe, expect, it } from 'vitest'
import { buildEditionSummary } from './monthly-editions'
import type { MonthlyEditionItem } from '@/types'

function item(
  id: string,
  title: string,
  publisher: string,
  section: MonthlyEditionItem['section'] = 'mencao_direta'
): MonthlyEditionItem {
  return {
    id,
    edition_id: 'edition',
    article_id: id,
    position: 1,
    section,
    cluster_key: null,
    article_snapshot: {
      id,
      title,
      url: null,
      image_url: null,
      excerpt: null,
      content: 'Texto disponível.',
      content_status: 'integral',
      author: null,
      published_at: '2026-07-28T12:00:00.000Z',
      publisher,
      source_name: publisher,
      source_categoria: 'imprensa',
    },
    classification_snapshot: {
      tom: 'neutro',
      relevancia: 'alta',
      cita_cliente: true,
      tema: 'transmissão',
      confidence: 0.9,
      impact_summary: 'A pauta afeta a operação do sistema.',
    },
    created_at: '2026-08-01T11:00:00.000Z',
  }
}

describe('monthly edition synthesis', () => {
  it('groups a similar story in the narrative while preserving every publication', () => {
    const items = [
      item('a', 'Temporal derruba 54 torres de transmissão em São Paulo', 'CNN Brasil'),
      item('b', 'Temporal em São Paulo derruba 54 torres de transmissão', 'MegaWhat'),
    ]
    const summary = buildEditionSummary(items, 'ONS', 'julho de 2026')
    expect(summary.data.directTopics).toBe(1)
    expect(summary.markdown).toContain('CNN Brasil e MegaWhat')
    expect(items).toHaveLength(2)
  })

  it('keeps low-confidence occurrences visible', () => {
    const summary = buildEditionSummary(
      [item('a', 'Ocorrência potencialmente relacionada', 'Rádio local', 'baixa_confianca')],
      'ONS',
      'julho de 2026'
    )
    expect(summary.data.uncertain).toBe(1)
    expect(summary.markdown).toContain('Outras ocorrências monitoradas')
  })
})
