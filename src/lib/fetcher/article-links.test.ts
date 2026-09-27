import { describe, expect, it } from 'vitest'
import { rankArticleLinks, scoreArticleLink } from './article-links'

const SITE = 'https://exemplo.com.br/'

describe('rankArticleLinks', () => {
  it('põe a matéria na frente do menu — o caso que gastava as 12 requisições', () => {
    // Ordem do DOM num site de notícias: o menu vem primeiro, sempre.
    const dom = [
      'https://exemplo.com.br/',
      'https://exemplo.com.br/sobre',
      'https://exemplo.com.br/contato',
      'https://exemplo.com.br/categoria/economia',
      'https://exemplo.com.br/2026/09/antaq-publica-resolucoes-136-a-141',
      'https://exemplo.com.br/2026/09/tcu-suspende-contrato-de-dragagem',
    ]
    const ranked = rankArticleLinks(dom, SITE)
    expect(ranked.slice(0, 2)).toEqual([
      'https://exemplo.com.br/2026/09/antaq-publica-resolucoes-136-a-141',
      'https://exemplo.com.br/2026/09/tcu-suspende-contrato-de-dragagem',
    ])
    expect(ranked.at(-1)).toBe('https://exemplo.com.br/')
  })

  it('reordena sem descartar: o conjunto continua o mesmo', () => {
    // Regra de projeto: um palpite sobre a estrutura do site alheio não pode
    // custar cobertura. Só extensão não-HTML sai.
    const dom = [
      'https://exemplo.com.br/sobre',
      'https://exemplo.com.br/noticia/184523',
      'https://exemplo.com.br/tag/portos',
    ]
    expect(rankArticleLinks(dom, SITE).sort()).toEqual([...dom].sort())
  })

  it('descarta só o que não é página HTML', () => {
    const dom = [
      'https://exemplo.com.br/edital.pdf',
      'https://exemplo.com.br/logo.png',
      'https://exemplo.com.br/2026/09/materia-real-sobre-hidrovias',
    ]
    expect(rankArticleLinks(dom, SITE)).toEqual(['https://exemplo.com.br/2026/09/materia-real-sobre-hidrovias'])
  })

  it('reconhece id numérico como matéria, não só slug com data', () => {
    expect(scoreArticleLink('https://exemplo.com.br/noticia/184523', SITE)).toBeGreaterThan(
      scoreArticleLink('https://exemplo.com.br/sobre', SITE)
    )
  })

  it('empate preserva a ordem do DOM, que é a ordem editorial', () => {
    const dom = [
      'https://exemplo.com.br/2026/09/manchete-principal-do-dia-hoje',
      'https://exemplo.com.br/2026/09/materia-secundaria-do-rodape',
    ]
    expect(rankArticleLinks(dom, SITE)).toEqual(dom)
  })

  it('não quebra com link inválido nem com a própria home', () => {
    expect(scoreArticleLink('não é url', SITE)).toBe(-100)
    expect(scoreArticleLink('https://exemplo.com.br/', SITE)).toBe(-50)
    expect(rankArticleLinks(['não é url', 'https://exemplo.com.br/2026/09/uma-materia-qualquer'], SITE).at(-1)).toBe(
      'não é url'
    )
  })
})
