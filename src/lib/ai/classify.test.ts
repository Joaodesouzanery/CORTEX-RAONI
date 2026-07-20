import { describe, it, expect } from 'vitest'
import { suggestTagsHeuristic, aiEnabled, type ClassifyClient } from './classify'
import type { Article } from '@/types'

function art(id: string, title: string, excerpt: string | null = null): Article {
  return {
    id,
    source_id: 's1',
    title,
    url: `https://ex.com/${id}`,
    image_url: null,
    excerpt,
    published_at: null,
    fetched_at: '2026-01-01T00:00:00Z',
  }
}

const client: ClassifyClient = { name: 'ONS', keywords: ['apagão', 'curtailment', 'ONS'], synonyms: null }

describe('suggestTagsHeuristic', () => {
  it('marks cita_cliente only on a whole-token match (no "ONS" inside "responsável")', () => {
    const [hit] = suggestTagsHeuristic([art('a', 'ONS aciona plano emergencial')], client)
    expect(hit.cita_cliente).toBe(true)
    const [miss] = suggestTagsHeuristic([art('b', 'Órgão responsável avança na obra')], client)
    expect(miss.cita_cliente).toBe(false)
  })

  it('infers tom from the PT lexicon and returns null when there is no signal', () => {
    const [neg] = suggestTagsHeuristic([art('a', 'Apagão e falha derrubam o sistema')], client)
    expect(neg.tom).toBe('negativo')
    const [pos] = suggestTagsHeuristic([art('b', 'Investimento amplia e moderniza a rede')], client)
    expect(pos.tom).toBe('positivo')
    const [none] = suggestTagsHeuristic([art('c', 'Reunião do comitê ocorre na terça')], client)
    expect(none.tom).toBeNull()
  })

  it('scales relevância with keyword hits in the title', () => {
    const [alta] = suggestTagsHeuristic([art('a', 'Apagão e curtailment atingem o ONS')], client)
    expect(alta.relevancia).toBe('alta') // 3 title keywords → score 6
    const [media] = suggestTagsHeuristic([art('b', 'Curtailment preocupa o setor', 'nota')], client)
    expect(media.relevancia).toBe('media') // 1 title keyword → score 2
    const [baixa] = suggestTagsHeuristic([art('c', 'Assunto sem relação alguma')], client)
    expect(baixa.relevancia).toBe('baixa')
  })

  it('suggests a tema from the first matched keyword, else null', () => {
    const [withTema] = suggestTagsHeuristic([art('a', 'Curtailment cresce no Nordeste')], client)
    expect(withTema.tema).toBe('curtailment')
    const [noTema] = suggestTagsHeuristic([art('b', 'Assunto genérico do dia')], client)
    expect(noTema.tema).toBeNull()
  })

  it('returns one suggestion per article, keyed by id', () => {
    const out = suggestTagsHeuristic([art('a', 'x'), art('b', 'y')], client)
    expect(out.map((s) => s.article_id)).toEqual(['a', 'b'])
  })
})

describe('aiEnabled', () => {
  it('is false when ANTHROPIC_API_KEY is unset (heuristic fallback path)', () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    expect(aiEnabled()).toBe(false)
    if (prev !== undefined) process.env.ANTHROPIC_API_KEY = prev
  })
})
