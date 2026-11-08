import { describe, expect, it } from 'vitest'
import { buildClippingDays, clippingMarkdown, joinOutlets, toneSentence, type ClippingItem } from './clipping-text'

// Fatos de outubro/2026 da ONS (docs/relatorios-refeitos/2026-10/ONS.md).
const items: ClippingItem[] = [
  {
    id: '1',
    published_at: '2026-10-16T13:00:00Z',
    outlet: 'CNN Brasil',
    title: 'ONS eleva previsão de crescimento da carga de energia no Brasil em outubro',
    url: 'https://www.cnnbrasil.com.br/infra/ons-eleva-previsao-de-crescimento-da-carga-de-energia-no-brasil-em-outubro/',
    cites_client: true,
    tone: 'neutro',
    summary: 'A publicação cita ONS diretamente.',
  },
  {
    id: '2',
    published_at: '2026-10-16T15:00:00Z',
    outlet: 'Agência Infra',
    title: 'ONS eleva previsão de crescimento da carga de energia para 4,9%',
    url: 'https://agenciainfra.com/blog/ons-eleva-previsao-de-crescimento-da-carga-de-energia-para-49/',
    cites_client: true,
    tone: 'neutro',
  },
  {
    id: '3',
    published_at: '2026-10-16T18:00:00Z',
    outlet: 'Valor Econômico',
    title: 'Âmbar investe R$ 59 milhões para reconfigurar térmica no Amazonas',
    url: 'https://valor.globo.com/empresas/noticia/2026/10/16/ambar-termica-amazonas.ghtml',
    cites_client: false,
    tone: 'neutro',
  },
  {
    id: '4',
    published_at: '2026-10-16T19:00:00Z',
    outlet: 'Google News',
    title: 'Setor de baterias mira leilão de capacidade',
    url: 'https://news.google.com/rss/articles/abc',
    cites_client: false,
  },
  {
    id: '5',
    published_at: '2026-10-29T12:00:00Z',
    outlet: 'Poder360',
    title: 'Estudo questiona critérios do ONS para cortes de geração',
    url: 'https://www.poder360.com.br/energia/estudo-questiona-criterios-do-ons/',
    cites_client: true,
    tone: 'negativo',
    summary: 'Volt Robotics aponta alta de 52% nos cortes.',
  },
]

describe('texto de clipping no formato do fornecedor da ONS', () => {
  const days = buildClippingDays(items)

  it('agrupa por dia de São Paulo e junta o mesmo fato em vários veículos', () => {
    expect(days.map((day) => day.day)).toEqual(['2026-10-16', '2026-10-29'])
    expect(days[0].client).toHaveLength(1)
    expect(days[0].client[0].outlets).toEqual(['CNN Brasil', 'Agência Infra'])
    expect(days[0].client[0].text).toBe(
      'CNN Brasil e Agência Infra publicaram “ONS eleva previsão de crescimento da carga de energia no Brasil em outubro”. A menção foi técnica.'
    )
  })

  it('setor abre com "Em setor," e só leva matéria com link exato, sem tom', () => {
    expect(days[0].sector).toHaveLength(1)
    expect(days[0].sector[0].text).toBe('Em setor, Valor Econômico publicou “Âmbar investe R$ 59 milhões para reconfigurar térmica no Amazonas”.')
    expect(days[0].sector[0].tone).toBeNull()
  })

  it('usa resumo próprio, ignora o genérico e fecha com o tom', () => {
    expect(days[1].client[0].text).toBe(
      'Poder360 publicou “Estudo questiona critérios do ONS para cortes de geração”. Volt Robotics aponta alta de 52% nos cortes. A menção foi negativa.'
    )
  })

  it('o markdown separa cliente e setor e leva os links', () => {
    const md = clippingMarkdown(days)
    expect(md).toContain('### Sexta-feira, 16/10/2026')
    expect(md).toContain('---')
    expect(md).toContain('[Valor Econômico](https://valor.globo.com/')
    expect(md).not.toContain('news.google.com')
  })

  it('título de terceiro não abre link nem quebra tabela no markdown', () => {
    const md = clippingMarkdown(
      buildClippingDays([{ ...items[0], title: 'ONS [veja](https://mal.example) | teste', id: 'x' }])
    )
    expect(md).not.toContain('](https://mal.example)')
    expect(md).not.toMatch(/teste.*\|/)
  })

  it('auxiliares', () => {
    expect(joinOutlets(['Folha', 'UOL', 'Agência Infra'])).toBe('Folha, UOL e Agência Infra')
    expect(toneSentence('positivo')).toBe('A menção foi positiva.')
    expect(toneSentence('critico')).toBe('A menção foi negativa.')
    expect(toneSentence(null)).toBe('A menção foi técnica.')
  })
})
