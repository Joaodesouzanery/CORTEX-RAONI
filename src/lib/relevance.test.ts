import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  classifyKeyword,
  parseKeywords,
  matchKeyword,
  isRelevant,
  relevanceScore,
} from './relevance'

describe('normalizeText', () => {
  it('strips accents, lowercases, and collapses punctuation', () => {
    expect(normalizeText('Térmica')).toBe('termica')
    expect(normalizeText('obras-de-arte!')).toBe('obras de arte')
    expect(normalizeText('Hidrovia,  à   BR-101')).toBe('hidrovia a br 101')
  })

  it('returns empty string for nullish/empty input', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
    expect(normalizeText('   ')).toBe('')
  })
})

describe('classifyKeyword', () => {
  it('detects acronyms (short, all-caps)', () => {
    expect(classifyKeyword('ONS')).toBe('acronym')
    expect(classifyKeyword('CCEE')).toBe('acronym')
    expect(classifyKeyword('DNIT')).toBe('acronym')
  })
  it('detects phrases (contain spaces)', () => {
    expect(classifyKeyword('setor elétrico')).toBe('phrase')
    expect(classifyKeyword('minerais críticos')).toBe('phrase')
    expect(classifyKeyword('obras de arte especiais')).toBe('phrase')
  })
  it('detects plain words', () => {
    expect(classifyKeyword('energia')).toBe('word')
    expect(classifyKeyword('hidrovia')).toBe('word')
  })
})

describe('matchKeyword — acronyms match whole tokens only', () => {
  const ons = parseKeywords(['ONS'])[0]
  it('matches the acronym as an isolated token', () => {
    expect(matchKeyword(ons, normalizeText('Comunicado do ONS sobre a carga'))).toBe(true)
  })
  it('does NOT match inside other words (false-positive guard)', () => {
    expect(matchKeyword(ons, normalizeText('Decisão responsável do órgão'))).toBe(false)
    expect(matchKeyword(ons, normalizeText('Foram bons resultados'))).toBe(false)
    expect(matchKeyword(ons, normalizeText('Houve consórcio entre empresas'))).toBe(false)
  })
})

describe('matchKeyword — phrases match contiguous tokens', () => {
  const kw = parseKeywords(['obras de arte especiais'])[0]
  it('matches the phrase in order', () => {
    expect(matchKeyword(kw, normalizeText('Novas obras de arte especiais na BR-101'))).toBe(true)
  })
  it('does NOT match when the order differs', () => {
    expect(matchKeyword(kw, normalizeText('obras especiais de arte'))).toBe(false)
  })
})

describe('matchKeyword — accents and simple plurals', () => {
  it('matches across accent differences', () => {
    const termica = parseKeywords(['térmica'])[0]
    expect(matchKeyword(termica, normalizeText('Usina termica entra em operação'))).toBe(true)
    expect(matchKeyword(termica, normalizeText('Geração térmica cresce'))).toBe(true)
  })
  it('matches singular keyword against plural text and vice-versa', () => {
    const hidrovia = parseKeywords(['hidrovia'])[0]
    expect(matchKeyword(hidrovia, normalizeText('As hidrovias do Norte'))).toBe(true)
    const pontes = parseKeywords(['pontes'])[0]
    expect(matchKeyword(pontes, normalizeText('Manutenção da ponte sobre o rio'))).toBe(true)
  })
})

describe('isRelevant — OR semantics over fields', () => {
  const kws = parseKeywords(['hidrovia', 'dragagem'])
  it('matches when a keyword is in the title', () => {
    expect(isRelevant(kws, { title: 'Obras de dragagem avançam', excerpt: null })).toBe(true)
  })
  it('matches when a keyword is only in the excerpt', () => {
    expect(isRelevant(kws, { title: 'Investimento federal', excerpt: 'foco em hidrovias' })).toBe(true)
  })
  it('does not match unrelated content', () => {
    expect(isRelevant(kws, { title: 'Reforma tributária avança', excerpt: 'sem relação' })).toBe(false)
  })
  it('returns false when there are no keywords', () => {
    expect(isRelevant([], { title: 'qualquer coisa' })).toBe(false)
  })
})

describe('relevanceScore', () => {
  const kws = parseKeywords(['energia', 'transmissão'])
  it('weights title matches above excerpt matches', () => {
    const titleScore = relevanceScore(kws, { title: 'energia', excerpt: null })
    const excerptScore = relevanceScore(kws, { title: 'nada', excerpt: 'energia' })
    expect(titleScore).toBeGreaterThan(excerptScore)
  })
  it('counts distinct matching keywords', () => {
    expect(relevanceScore(kws, { title: 'energia e transmissão', excerpt: null })).toBe(4)
  })
})
