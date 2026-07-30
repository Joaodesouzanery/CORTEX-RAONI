import { describe, expect, it } from 'vitest'
import { topicMatchesArticle } from './monthly-agenda'

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
