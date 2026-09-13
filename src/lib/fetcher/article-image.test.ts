import { describe, expect, it } from 'vitest'
import { isGenericImage, pickImageCandidate } from './article-image'

describe('isGenericImage', () => {
  it('reconhece o logo do Google News que envenenava o acervo', () => {
    // Esta URL exata era gravada como "foto" de TODO artigo vindo do Google
    // News — e, como image_url deixava de ser nulo, o artigo nunca mais era
    // tentado.
    expect(
      isGenericImage(
        'https://lh3.googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNNfDvGUmWUy20nuUhkREQyrpY4bEeIBuc=s0-w300-rw'
      )
    ).toBe(true)
    expect(isGenericImage('https://news.google.com/qualquer.png')).toBe(true)
  })

  it('reconhece o brasão e a logo das páginas gov.br', () => {
    // Em gov.br o og:image é o brasão da agência, não a foto da matéria.
    expect(isGenericImage('https://www.gov.br/antaq/logo.png')).toBe(true)
    expect(isGenericImage('https://www.gov.br/antaq/++theme++padrao_gov/img/brasao.svg')).toBe(true)
    expect(isGenericImage('https://www.gov.br/aneel/imagens/marca-dagua.png')).toBe(true)
  })

  it('reconhece placeholders e pixels de rastreio', () => {
    expect(isGenericImage('https://v.com/img/placeholder.jpg')).toBe(true)
    expect(isGenericImage('https://v.com/img/sem-imagem.png')).toBe(true)
    expect(isGenericImage('https://v.com/og-default.jpg')).toBe(true)
    expect(isGenericImage('https://v.com/1x1.png')).toBe(true)
    expect(isGenericImage('https://v.com/anim.gif')).toBe(true)
    expect(isGenericImage('data:image/png;base64,iVBOR')).toBe(true)
  })

  it('trata ausência e lixo como genérico', () => {
    expect(isGenericImage(null)).toBe(true)
    expect(isGenericImage(undefined)).toBe(true)
    expect(isGenericImage('')).toBe(true)
    expect(isGenericImage('não é url')).toBe(true)
  })

  it('aceita foto de matéria de verdade', () => {
    expect(isGenericImage('https://www.gov.br/antaq/noticias/2026/08/porto-de-santos.jpg')).toBe(false)
    expect(isGenericImage('https://s2.glbimg.com/foo/bar/materia-hidrovia.jpg')).toBe(false)
    expect(isGenericImage('https://cdn.veiculo.com.br/uploads/2026/08/audiencia-publica.webp')).toBe(false)
  })
})

describe('pickImageCandidate', () => {
  const base = 'https://www.gov.br/antaq/pt-br/noticias/materia'

  it('pula o brasão e alcança a foto do corpo — a correção do gov.br', () => {
    // Antes era "primeiro candidato vence", e og:image vinha primeiro: a foto
    // da matéria nunca era alcançada.
    const escolhida = pickImageCandidate(
      ['https://www.gov.br/antaq/logo.png', null, '/noticias/2026/foto-audiencia.jpg'],
      base
    )
    expect(escolhida).toBe('https://www.gov.br/noticias/2026/foto-audiencia.jpg')
  })

  it('devolve null quando todos os candidatos são genéricos', () => {
    // null é melhor que imagem errada: mantém o artigo elegível a nova
    // tentativa em vez de marcá-lo como resolvido para sempre.
    expect(
      pickImageCandidate(
        ['https://lh3.googleusercontent.com/J6_coFbog', 'https://news.google.com/x.png'],
        'https://news.google.com/rss/articles/abc'
      )
    ).toBeNull()
  })

  it('absolutiza caminho relativo e forma relativa ao protocolo', () => {
    expect(pickImageCandidate(['/img/foto.jpg'], base)).toBe('https://www.gov.br/img/foto.jpg')
    expect(pickImageCandidate(['//cdn.v.com/foto.jpg'], base)).toBe('https://cdn.v.com/foto.jpg')
  })

  it('mantém a ordem de preferência entre candidatos válidos', () => {
    expect(
      pickImageCandidate(['https://v.com/og.jpg', 'https://v.com/twitter.jpg'], base)
    ).toBe('https://v.com/og.jpg')
  })

  it('lida com lista vazia e só nulos', () => {
    expect(pickImageCandidate([], base)).toBeNull()
    expect(pickImageCandidate([null, undefined, ''], base)).toBeNull()
  })
})
