import { describe, expect, it } from 'vitest'
import { PROVISIONAL_RATIONALE, deriveProvisionalTopics, topicMatchesArticle } from './monthly-agenda'

const article = (title: string) => ({ title, excerpt: null, content: null })

describe('monthly agenda matching', () => {
  it('never treats Pará or sustentabilidade alone as mineral coverage', () => {
    const topic = {
      title: 'Mineração e sustentabilidade',
      inclusion_terms: ['Pará', 'sustentabilidade'],
      exclusion_terms: [],
    }
    expect(topicMatchesArticle(topic, article('Programa de sustentabilidade para escolas do Pará')).matched).toBe(false)
    expect(topicMatchesArticle(topic, article('Mineração e sustentabilidade avançam no Pará')).matched).toBe(true)
  })

  it('honors exclusions and finds critical minerals', () => {
    const topic = {
      title: 'Minerais críticos e estratégicos',
      inclusion_terms: ['minerais críticos', 'terras raras'],
      exclusion_terms: ['ETF'],
    }
    expect(topicMatchesArticle(topic, article('ETF de terras raras estreia na bolsa')).matched).toBe(false)
    expect(topicMatchesArticle(topic, article('Política de minerais críticos avança no Senado')).matched).toBe(true)
  })

  it('does not cover sustainability with mining alone', () => {
    const topic = {
      title: 'Mineração e sustentabilidade',
      inclusion_terms: ['mineração', 'sustentabilidade'],
      exclusion_terms: [],
    }
    expect(topicMatchesArticle(topic, article('Produção da mineração cresce no trimestre')).matched).toBe(false)
    expect(topicMatchesArticle(topic, article('Mineração avança com proteção da biodiversidade')).matched).toBe(true)
  })

  it('requires both mining and Amazon context for the composite topic', () => {
    const topic = {
      title: 'Mineração e Amazônia',
      inclusion_terms: ['mineração', 'Amazônia'],
      exclusion_terms: [],
    }
    expect(topicMatchesArticle(topic, article('Programa de turismo sustentável na Amazônia')).matched).toBe(false)
    expect(topicMatchesArticle(topic, article('Mineração em Carajás e desenvolvimento amazônico')).matched).toBe(true)
  })
})

describe('agenda provisória para cliente sem templates', () => {
  it('deriva um tópico por eixo permanente, nunca obrigatório', () => {
    const topics = deriveProvisionalTopics(
      ['navegação de cabotagem', 'regulação portuária'],
      ['ANTAQ'],
      'ANTAQ'
    )
    expect(topics.map((topic) => topic.title)).toEqual(['navegação de cabotagem', 'regulação portuária'])
    // Obrigatoriedade fabricada por máquina bloquearia o fechamento do mês.
    expect(topics.every((topic) => topic.required === false)).toBe(true)
    expect(topics[0].inclusion_terms).toEqual(['navegação de cabotagem'])
    expect(topics[0].rationale).toBe(PROVISIONAL_RATIONALE)
  })

  it('cai para um tópico guarda-chuva com as keywords quando não há eixos', () => {
    const topics = deriveProvisionalTopics([], ['porto', 'hidrovia', 'cabotagem'], 'ANTAQ')
    expect(topics).toHaveLength(1)
    expect(topics[0].title).toBe('Cobertura geral — ANTAQ')
    expect(topics[0].inclusion_terms).toEqual(['porto', 'hidrovia', 'cabotagem'])
    expect(topics[0].required).toBe(false)
  })

  it('limita o guarda-chuva a 12 termos', () => {
    const keywords = Array.from({ length: 30 }, (_, index) => `termo-${index}`)
    expect(deriveProvisionalTopics([], keywords, 'X')[0].inclusion_terms).toHaveLength(12)
  })

  it('ignora entradas vazias e não devolve nada quando não há do que derivar', () => {
    expect(deriveProvisionalTopics(['  ', ''], ['   '], 'X')).toEqual([])
    expect(deriveProvisionalTopics([], [], null)).toEqual([])
  })
})
