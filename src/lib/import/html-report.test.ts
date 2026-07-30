import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseHtmlReferenceReport } from './html-report'

describe('HTML strategic report parser', () => {
  it('extracts the qualified evidence table and strategic signals', () => {
    const html = `
      <html><head><title>Relatório ONS Junho 2026</title></head><body>
        <table><tr><th>Tema estratégico</th><th>Relevância</th><th>Sinal do mês</th></tr>
          <tr><td>Operação do SIN</td><td>Alta</td><td>Sistema permaneceu estável.</td></tr>
        </table>
        <p><strong>Leitura estratégica:</strong> reforçar a autoridade técnica.</p>
        <table><tr><th>Data</th><th>Veículo</th><th>Jornalista / assinatura</th><th>Título</th><th>Tom</th></tr>
          <tr><td>28/06</td><td>CNN</td><td>Redação</td><td>ONS aponta estabilidade do sistema</td><td>Técnico</td></tr>
          <tr><td>27/06</td><td>Valor</td><td>Autora</td><td>Operação entra em nova etapa</td><td>Positivo</td></tr>
        </table>
      </body></html>`
    const parsed = parseHtmlReferenceReport(new TextEncoder().encode(html), 'Relatorio ONS Junho 2026.html')
    expect(parsed.evidence).toHaveLength(2)
    expect(parsed.evidence[0]).toMatchObject({
      publisher: 'CNN',
      author: 'Redação',
      tone: 'neutro',
    })
    expect(parsed.evidence[0].published_at).toContain('2026-06-28')
    expect(parsed.metadata).toMatchObject({ evidence_count: 2, source_format: 'html' })
  })
})

const downloads = '/Users/joaonery/Downloads'
const reports = [
  ['Relatorio DAQ Junho 2026.dc.html', 29],
  ['Relatorio ONS Junho 2026.dc.html', 33],
  ['Relatorio SindInfor Junho 2026.dc.html', 40],
] as const

describe.skipIf(!reports.every(([filename]) => existsSync(`${downloads}/${filename}`)))(
  'provided June reference reports',
  () => {
    for (const [filename, expected] of reports) {
      it(`recovers ${expected} qualified rows from ${filename}`, () => {
        const parsed = parseHtmlReferenceReport(
          new Uint8Array(readFileSync(`${downloads}/${filename}`)),
          filename
        )
        expect(parsed.evidence).toHaveLength(expected)
        expect(parsed.evidence.every((item) => item.title.length > 5)).toBe(true)
      })
    }
  }
)
