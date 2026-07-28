import { PDFDocument } from 'pdf-lib'
import { renderEdition } from './render-monthly-clipping.mjs'

const count = Number(process.argv[2] || 500)
if (!Number.isInteger(count) || count < 1) throw new Error('Informe uma contagem inteira positiva.')

const items = Array.from({ length: count }, (_, index) => ({
  id: `item-${index + 1}`,
  article_id: `article-${index + 1}`,
  section: index % 5 === 0 ? 'mencao_direta' : index % 11 === 0 ? 'baixa_confianca' : 'cobertura_setorial',
  article_snapshot: {
    id: `article-${index + 1}`,
    title: `Publicação de carga ${String(index + 1).padStart(4, '0')}`,
    url: index % 7 === 0 ? null : `https://example.com/noticia/${index + 1}`,
    image_url: null,
    excerpt: 'Trecho de validação.',
    content:
      `Texto integral sintético do item ${index + 1}. ` +
      'Este parágrafo verifica paginação, sumário e preservação individual das publicações. '.repeat(8),
    content_status: index % 13 === 0 ? 'parcial' : 'integral',
    author: index % 3 === 0 ? 'Autoria de teste' : null,
    published_at: `2026-07-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    publisher: `Veículo ${(index % 17) + 1}`,
    source_name: `Fonte ${(index % 9) + 1}`,
    source_categoria: index % 4 === 0 ? 'institucional' : 'imprensa',
  },
  classification_snapshot: {
    tom: index % 10 === 0 ? 'negativo' : 'neutro',
    relevancia: index % 11 === 0 ? 'baixa' : 'media',
    cita_cliente: index % 5 === 0,
    tema: 'carga',
    confidence: index % 11 === 0 ? 0.4 : 0.8,
    impact_summary: 'Registro sintético para o teste de carga do clipping.',
  },
}))

const edition = {
  id: 'load-test',
  period_month: '2026-07-01',
  version: 1,
  clients: { name: 'CLIENTE DE TESTE' },
  counts: {
    total: count,
    integral: items.filter((item) => item.article_snapshot.content_status === 'integral').length,
    parcial: items.filter((item) => item.article_snapshot.content_status === 'parcial').length,
    metadados: 0,
    mencoes_diretas: items.filter((item) => item.section === 'mencao_direta').length,
    cobertura_setorial: items.filter((item) => item.section === 'cobertura_setorial').length,
    baixa_confianca: items.filter((item) => item.section === 'baixa_confianca').length,
  },
  summary_markdown:
    '# Síntese do clipping\n\n## Menções diretas\n\nCarga sintética.\n\n## Cobertura setorial\n\nCarga sintética.',
  items,
}

const startedAt = Date.now()
const bytes = await renderEdition(edition)
const pdf = await PDFDocument.load(bytes)
const pages = pdf.getPageCount()
const heapMb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
if (pages < count) throw new Error(`PDF omitiu itens: ${pages} páginas para ${count} publicações.`)
if (heapMb > 1024) throw new Error(`Uso de heap acima do limite: ${heapMb} MB.`)
process.stdout.write(
  JSON.stringify({
    publications: count,
    pages,
    bytes: bytes.length,
    heapMb,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 100) / 10,
  }) + '\n'
)
