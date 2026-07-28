import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalArticleFingerprint, sameImportedPublication } from '../archive'
import { parsePdf, parseVendorClippingPages } from './pdf-parser'

describe('vendor clipping parser', () => {
  it('joins continuation pages while preserving page boundaries', () => {
    const footer = '7/27/2026 | MEGAWHAT | Clique aqui para visualizar a notícia no navegador'
    const articles = parseVendorClippingPages([
      { num: 1, text: 'Sumário\nPauta - MEGAWHAT 1' },
      { num: 2, text: `Título da pauta\nTexto inicial suficientemente longo.\nTítulo da pauta\n${footer}` },
      { num: 3, text: `Continuação do texto.\nTítulo da pauta\n${footer}\nContinuação` },
      {
        num: 4,
        text: 'Outra pauta\nOutro texto.\nOutra pauta\n7/28/2026 | CNN BRASIL ONLINE | Clique aqui para visualizar a notícia no navegador',
      },
    ])
    expect(articles).toHaveLength(2)
    expect(articles[0].page_start).toBe(2)
    expect(articles[0].page_end).toBe(3)
    expect(articles[0].content).toContain('Continuação do texto')
    expect(articles[1].publisher).toBe('CNN BRASIL ONLINE')
  })
})

const downloads = '/Users/joaonery/Downloads'
const realFiles = [
  'Clipping ONS 13.07.2026.pdf',
  'Clipping ONS 14.07.2026.pdf',
  'Clipping ONS 15.07.2026.pdf',
  'Clipping ONS 27.07.2026.pdf',
  'Clipping ONS 28.07.2026.pdf',
]
const individualFiles = [
  'Regulação moderna para lidar com a nova matriz elétrica.pdf',
  'Londres, o Brasil e os biocombustíveis.pdf',
  "Lula diz que 'mulher estuda o que quiser' e defende formação de mais engenheiras no país.pdf",
  'Belo Monte fecha primeiro semestre com geração equivalente a 6,56% da demanda nacional, diz Norte Energia.pdf',
  'Corte de energia é desafio no Brasil, diz EDP.pdf',
  'A GD é ‘hipoteca’ energética superonerosa.pdf',
  'Aneel abre consulta pública para discutir mudanças na remuneração das distribuidoras.pdf',
  'CNPE abre espaço para Eletronuclear negociar suspensão de dívidas de Angra 3 com bancos.pdf',
  'Verificação de emissões pode alcançar até 400 empresas, prevê Fazenda.pdf',
]

describe.skipIf(![...realFiles, ...individualFiles].every((filename) => existsSync(`${downloads}/${filename}`)))(
  'provided 14-PDF regression set',
  () => {
    for (const filename of realFiles) {
      it(`extracts every recognizable article from ${filename}`, async () => {
        const parsed = await parsePdf(new Uint8Array(readFileSync(`${downloads}/${filename}`)), filename)
        expect(parsed.documentType).toBe('caderno')
        expect(parsed.articles.length).toBeGreaterThan(10)
        expect(parsed.metadata.toc_entries).toBe(parsed.articles.length)
        expect(parsed.articles.every((a) => a.title && a.publisher && a.page_start <= a.page_end)).toBe(true)
        expect(
          parsed.articles.every((article) => ['integral', 'parcial', 'metadados'].includes(article.content_status))
        ).toBe(true)
        expect(
          parsed.articles.slice(1).every((article, index) => article.page_start === parsed.articles[index].page_end + 1)
        ).toBe(true)
      }, 30000)
    }

    for (const filename of individualFiles) {
      it(`recognizes ${filename} as one complete article`, async () => {
        const parsed = await parsePdf(new Uint8Array(readFileSync(`${downloads}/${filename}`)), filename)
        expect(parsed.documentType).toBe('artigo')
        expect(parsed.articles).toHaveLength(1)
        expect(parsed.articles[0].title.length).toBeGreaterThan(15)
        expect(parsed.articles[0].content.length).toBeGreaterThan(500)
        expect(parsed.articles[0].page_start).toBe(1)
        expect(parsed.articles[0].page_end).toBe(parsed.pageCount)
      }, 30000)
    }

    it('recognizes the repeated Belo Monte article despite conflicting PDF publisher metadata', async () => {
      const filename =
        'Belo Monte fecha primeiro semestre com geração equivalente a 6,56% da demanda nacional, diz Norte Energia.pdf'
      const individual = await parsePdf(new Uint8Array(readFileSync(`${downloads}/${filename}`)), filename)
      const cadernos = await Promise.all(
        realFiles.map((name) => parsePdf(new Uint8Array(readFileSync(`${downloads}/${name}`)), name))
      )
      const repeated = cadernos
        .flatMap((parsed) => parsed.articles)
        .find((article) => article.title.toLocaleLowerCase('pt-BR').includes('belo monte fecha'))
      expect(repeated).toBeDefined()
      expect(repeated!.publisher).not.toBe(individual.articles[0].publisher)
      expect(await canonicalArticleFingerprint(repeated!)).not.toBe(
        await canonicalArticleFingerprint(individual.articles[0])
      )
      expect(
        sameImportedPublication(repeated!, individual.articles[0]),
        JSON.stringify({
          repeatedLength: repeated!.content.length,
          individualLength: individual.articles[0].content.length,
          repeatedStart: repeated!.content.slice(0, 220),
          individualStart: individual.articles[0].content.slice(0, 220),
        })
      ).toBe(true)
    }, 30000)
  }
)
