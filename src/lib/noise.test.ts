import { describe, expect, it } from 'vitest'
import { isOffTopicSection } from './noise'

describe('isOffTopicSection', () => {
  it('reconhece cadernos de esporte e entretenimento pelo link', () => {
    expect(isOffTopicSection('https://ge.globo.com/futebol/noticia/2026/10/01/x.ghtml')).toBe(true)
    expect(isOffTopicSection('https://g1.globo.com/pop-arte/noticia/2026/10/01/x.ghtml')).toBe(true)
    expect(isOffTopicSection('https://www.estadao.com.br/esportes/futebol/x/')).toBe(true)
    expect(isOffTopicSection('https://oglobo.globo.com/rj/esporte/x.ghtml')).toBe(true)
    expect(isOffTopicSection('https://www.uol.com.br/esporte/x.htm')).toBe(true)
  })

  it('mantém economia, política e energia dos mesmos veículos', () => {
    expect(isOffTopicSection('https://g1.globo.com/economia/noticia/2026/10/01/x.ghtml')).toBe(false)
    expect(isOffTopicSection('https://valor.globo.com/empresas/noticia/2026/10/01/x.ghtml')).toBe(false)
    expect(isOffTopicSection('https://www.estadao.com.br/economia/x/')).toBe(false)
    expect(isOffTopicSection('https://www1.folha.uol.com.br/mercado/2026/10/x.shtml')).toBe(false)
  })

  it('pega rodada de campeonato pelo título quando o link ainda é do Google News', () => {
    expect(isOffTopicSection('https://news.google.com/rss/articles/abc', 'Flamengo vence e lidera o Brasileirão')).toBe(true)
    expect(isOffTopicSection('https://news.google.com/rss/articles/abc', 'A novela do leilão de transmissão')).toBe(false)
  })

  it('não quebra com link inválido ou ausente', () => {
    expect(isOffTopicSection(null)).toBe(false)
    expect(isOffTopicSection('não é url')).toBe(false)
  })
})
