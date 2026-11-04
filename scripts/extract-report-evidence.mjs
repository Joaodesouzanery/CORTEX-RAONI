#!/usr/bin/env node
// Extrai a base de evidências dos relatórios entregues (.dc.html) para JSON.
// É o gabarito do Cortex: o que a consultoria de fato entregou, por cliente e mês.
// Os .dc.html são DADO: só lemos texto e href das linhas de tabela.
//
// Uso: node scripts/extract-report-evidence.mjs [pasta] > docs/referencia-relatorios/gabarito.json
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] || 'docs/referencia-relatorios/modelo'

const MONTHS = { junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11 }
// Nome no arquivo → nome do cliente no banco (clients.name).
const CLIENTS = [
  [/SindInfor/i, 'SINDINFOR'],
  [/CCEE/, 'CCEE'],
  [/PRIO/, 'PRIO'],
  [/SIMINERAL/, 'SIMINERAL'],
  [/DAQ/, 'DAQ'],
  [/ONS/, 'ONS'],
  [/ANTAQ/, 'ANTAQ'],
]

const decode = (text) =>
  text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/↗/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export function parseReportRows(html, year) {
  const items = []
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1])
    if (cells.length < 3) continue
    const first = decode(cells[0])
    // Linha de evidência começa por data dd/mm (às vezes "# dd/mm" com número antes).
    // Data por dia (dd/mm) ou só mês ("Out/26", usado em outubro).
    const isDate = (cell) => /^(\d{1,2}\/\d{1,2}(\/\d{2,4})?|[A-Za-zç]{3}\/\d{2})$/.test(decode(cell).replace(/\s/g, ''))
    const dateCellIndex = cells.findIndex(isDate)
    if (dateCellIndex < 0 || dateCellIndex > 1) continue
    const rest = cells.slice(dateCellIndex)
    const rawDate = decode(rest[0]).replace(/\s/g, '')
    const [day, month] = /^\d/.test(rawDate) ? rawDate.split('/').map(Number) : [null, null]
    const link = rest[2]?.match(/href=["'](https?:\/\/[^"']+)["']/i)?.[1]?.replace(/&amp;/g, '&') || null
    items.push({
      date: day ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null,
      outlet: decode(rest[1] || ''),
      title: decode(rest[2] || ''),
      url: link,
      spokesperson: rest[3] ? decode(rest[3]) : null,
      tone: rest[4] ? decode(rest[4]) : null,
      first_cell: first,
    })
  }
  // Boletins (lista, sem tabela): toda âncora de matéria fora das linhas acima.
  const seen = new Set(items.map((item) => item.url).filter(Boolean))
  for (const anchor of html.matchAll(/<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = anchor[1].replace(/&amp;/g, '&')
    if (seen.has(url) || /fonts\.(googleapis|gstatic)/.test(url)) continue
    const parsed = new URL(url)
    if (parsed.pathname === '/' || parsed.pathname === '') continue
    seen.add(url)
    items.push({ date: null, outlet: parsed.hostname.replace(/^www\./, ''), title: decode(anchor[2]), url, spokesperson: null, tone: null, first_cell: '' })
  }
  return items
}

const reports = []
for (const name of readdirSync(dir).filter((file) => file.endsWith('.dc.html')).sort()) {
  const client = CLIENTS.find(([pattern]) => pattern.test(name))?.[1]
  const monthName = Object.keys(MONTHS).find((month) => name.toLowerCase().includes(month))
  const year = Number(name.match(/20\d\d/)?.[0] || 2026)
  if (!client || !monthName) continue
  const html = readFileSync(join(dir, name), 'utf8')
  const items = parseReportRows(html, year).map(({ first_cell: _drop, ...item }) => item)
  reports.push({
    file: name,
    client,
    variant: /Associados/i.test(name) ? 'associados' : /Completo/i.test(name) ? 'completo' : 'principal',
    period: `${year}-${String(MONTHS[monthName]).padStart(2, '0')}`,
    items,
  })
}

process.stdout.write(`${JSON.stringify({ generated_from: dir, reports }, null, 2)}\n`)
