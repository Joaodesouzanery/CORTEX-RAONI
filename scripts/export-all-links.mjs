#!/usr/bin/env node
// Junta TODOS os links de notícia já reunidos no projeto num único CSV
// (docs/links/todas-as-noticias.csv) e um resumo (docs/links/README.md).
// Origens: relatórios entregues (gabarito), refeitos verificados, CSVs do
// Cortex, .md do Claude Chat, PDFs finais e manchetes do clipping da ONS.
// Tudo aqui é DADO de terceiro: só lemos títulos, veículos, datas e URLs.
//
// Uso: node scripts/export-all-links.mjs
// Pré-requisito para os PDFs: python scripts/extract-pdf-links.py <pasta> > docs/links/pdf-links.json
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT_DIR = 'docs/links'
const FINAL = 'docs/referencia-relatorios/2026-10-final'
const CLIENTS = [
  [/sindinfor/i, 'SINDINFOR'],
  [/ccee/i, 'CCEE'],
  [/prio/i, 'PRIO'],
  [/simineral/i, 'SIMINERAL'],
  [/daq|dnit/i, 'DAQ'],
  [/antaq/i, 'ANTAQ'],
  [/\bons\b|ons[-_ ]/i, 'ONS'],
]
const clientOf = (name) => CLIENTS.find(([pattern]) => pattern.test(name))?.[1] ?? null

// Mesma regra de src/lib/report-selection.ts (linkStatus), em JS puro para o script.
function linkStatus(url) {
  if (!url) return 'ausente'
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return 'invalido'
  }
  if (/(^|\.)news\.google\.com$/.test(parsed.hostname)) return 'google_news'
  if (parsed.searchParams.has('p') && (parsed.pathname === '/' || /\/blog\/?$/.test(parsed.pathname))) return 'id_curto'
  const segments = parsed.pathname.split('/').filter(Boolean)
  if (!segments.length) return 'secao'
  const last = segments[segments.length - 1]
  return segments.length >= 3 || /-/.test(last) || /\d{4,}/.test(parsed.pathname) ? 'exato' : 'secao'
}

const normalizeUrl = (url) => {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^oc$/i.test(key)) parsed.searchParams.delete(key)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`
  } catch {
    return url
  }
}

function brDate(text) {
  const match = String(text || '').match(/(\d{2})\/(\d{2})\/(\d{4})/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"'
        index++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') cell += char
  }
  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const [header, ...body] = rows
  return body.filter((values) => values.length > 1).map((values) => Object.fromEntries(header.map((key, index) => [key.replace(/^﻿/, ''), values[index] ?? ''])))
}

/** Linhas numeradas de tabela markdown: "| 1 | 05/10/2026 | Veículo | [Título](url) | ...". */
function parseMarkdownTable(text) {
  const items = []
  for (const line of text.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim())
    const linkCell = cells.find((cell) => /\]\(https?:\/\//.test(cell))
    const link = linkCell?.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/)
    if (!link && !brDate(cells[1])) continue
    const linkText = link?.[1] ?? ''
    // No .md do Claude Chat o link é "Leia a matéria" e o título fica na coluna 4.
    const title = /leia a mat/i.test(linkText) ? cells[3] : linkText || cells[3]
    items.push({ date: brDate(cells[1]), outlet: cells[2], title, url: link?.[2] ?? null })
  }
  return items
}

const records = []
const add = (record) => records.push({ verificado: 'nao', ...record })

// 1. Relatórios entregues (jun–out), extraídos dos .dc.html.
const gabarito = JSON.parse(readFileSync('docs/referencia-relatorios/gabarito.json', 'utf8'))
for (const report of gabarito.reports) {
  for (const item of report.items) {
    add({ cliente: report.client, mes: report.period, origem: `entregue:${report.file}`, data: item.date, veiculo: item.outlet, titulo: item.title, url: item.url })
  }
}

// 2. Refeitos de outubro: abertos e conferidos um a um.
const refeitos = 'docs/relatorios-refeitos/2026-10'
for (const file of readdirSync(refeitos).filter((name) => name.endsWith('.md') && name !== 'RESUMO.md')) {
  for (const item of parseMarkdownTable(readFileSync(join(refeitos, file), 'utf8')).slice(0, 20)) {
    add({ cliente: clientOf(file), mes: '2026-10', origem: `refeito:${file}`, data: item.date, veiculo: item.outlet, titulo: item.title, url: item.url, verificado: 'sim' })
  }
}

// 3. CSVs exportados pelo Cortex em outubro.
for (const file of readdirSync(join(FINAL, 'csv-cortex')).filter((name) => name.endsWith('.csv'))) {
  for (const row of parseCsv(readFileSync(join(FINAL, 'csv-cortex', file), 'utf8'))) {
    add({ cliente: clientOf(file), mes: String(row.published_at).slice(0, 7), origem: `cortex-csv:${file}`, data: String(row.published_at).slice(0, 10), veiculo: row.vehicle, titulo: row.title, url: row.url })
  }
}

// 4. Rodada nova do Claude Chat (a partir do CSV).
for (const file of readdirSync(join(FINAL, 'md-claude-chat')).filter((name) => name.endsWith('.md'))) {
  for (const item of parseMarkdownTable(readFileSync(join(FINAL, 'md-claude-chat', file), 'utf8'))) {
    add({ cliente: clientOf(file), mes: '2026-10', origem: `claude-chat:${file}`, data: item.date, veiculo: item.outlet, titulo: item.title, url: item.url })
  }
}

// 5. Links clicáveis dos PDFs finais (Claude Design).
if (existsSync(join(OUT_DIR, 'pdf-links.json'))) {
  for (const item of JSON.parse(readFileSync(join(OUT_DIR, 'pdf-links.json'), 'utf8'))) {
    add({ cliente: item.client, mes: '2026-10', origem: `pdf-final:${item.file}`, data: null, veiculo: null, titulo: null, url: item.url })
  }
}

// 6. Manchetes do clipping diário da ONS (fornecedor): sem link no PDF.
const onsClipping = 'docs/evidencias/2026-10/gabarito-ons/manchetes-clipping-ons-2026-10.json'
for (const [file, title, outlet] of JSON.parse(readFileSync(onsClipping, 'utf8'))) {
  const match = file.match(/(\d{2})\.(\d{2})\.(\d{4})/)
  add({ cliente: 'ONS', mes: '2026-10', origem: `clipping-fornecedor:${file}`, data: match ? `${match[3]}-${match[2]}-${match[1]}` : null, veiculo: outlet, titulo: title, url: null })
}

// Dedupe por URL normalizada (+cliente); sem URL, por título+cliente. Origens acumulam.
const merged = new Map()
for (const record of records) {
  const key = `${record.cliente}|${record.url ? normalizeUrl(record.url) : `t:${String(record.titulo).toLowerCase()}`}`
  const current = merged.get(key)
  if (!current) {
    merged.set(key, { ...record, origens: [record.origem] })
    continue
  }
  current.origens.push(record.origem)
  for (const field of ['data', 'veiculo', 'titulo']) current[field] ||= record[field]
  if (record.verificado === 'sim') current.verificado = 'sim'
}

const rows = [...merged.values()].map((record) => ({ ...record, link_status: linkStatus(record.url) }))
rows.sort((a, b) => String(a.cliente).localeCompare(String(b.cliente)) || String(a.mes).localeCompare(String(b.mes)) || String(a.data).localeCompare(String(b.data)))

const csvCell = (value) => {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const header = ['cliente', 'mes', 'data', 'veiculo', 'titulo', 'url', 'link_status', 'verificado', 'origens']
writeFileSync(
  join(OUT_DIR, 'todas-as-noticias.csv'),
  `${[header.join(','), ...rows.map((row) => header.map((field) => csvCell(field === 'origens' ? row.origens.join(' | ') : row[field])).join(','))].join('\n')}\n`
)

// Resumo por cliente e por status do link.
const count = (filter) => rows.filter(filter).length
const clients = [...new Set(rows.map((row) => row.cliente))].sort()
const summaryRows = clients.map((client) => {
  const of = (filter) => count((row) => row.cliente === client && filter(row))
  return `| ${client} | ${of(() => true)} | ${of((row) => row.link_status === 'exato')} | ${of((row) => row.verificado === 'sim')} | ${of((row) => row.link_status === 'google_news')} | ${of((row) => ['id_curto', 'secao', 'invalido'].includes(row.link_status))} | ${of((row) => row.link_status === 'ausente')} |`
})
const byOrigin = {}
for (const record of records) {
  const origin = record.origem.split(':')[0]
  byOrigin[origin] = (byOrigin[origin] || 0) + 1
}
writeFileSync(
  join(OUT_DIR, 'README.md'),
  `# Todos os links de notícia do projeto

Gerado por \`node scripts/export-all-links.mjs\`. O arquivo é \`todas-as-noticias.csv\`, com uma linha por notícia e cliente, deduplicada por URL.

## Por cliente

| Cliente | Notícias | Link exato | Verificadas (refeitos) | Google News sem resolver | Link suspeito (?p=, seção) | Sem link |
|---|---|---|---|---|---|---|
${summaryRows.join('\n')}
| **Total** | **${rows.length}** | **${count((row) => row.link_status === 'exato')}** | **${count((row) => row.verificado === 'sim')}** | **${count((row) => row.link_status === 'google_news')}** | **${count((row) => ['id_curto', 'secao', 'invalido'].includes(row.link_status))}** | **${count((row) => row.link_status === 'ausente')}** |

## Por origem (antes de deduplicar)

| Origem | Itens | Confiança |
|---|---|---|
| refeito | ${byOrigin.refeito || 0} | **Alta.** Cada link foi aberto, com título, veículo e data conferidos (docs/relatorios-refeitos/2026-10) |
| entregue | ${byOrigin.entregue || 0} | Baixa nos links. Ver docs/auditoria/ (veículo diferente do domínio, link de outro mês) |
| cortex-csv | ${byOrigin['cortex-csv'] || 0} | Média. Classificação automática, sem triagem; muitos links do Google News |
| claude-chat | ${byOrigin['claude-chat'] || 0} | Média. Escolhidos do CSV; links diretos, mas com viés para portais especializados |
| pdf-final | ${byOrigin['pdf-final'] || 0} | Média. Inclui links do Google News e ?p= que chegaram ao cliente |
| clipping-fornecedor | ${byOrigin['clipping-fornecedor'] || 0} | Manchetes do clipping da ONS (19 a 30/10), sem link |

## Como usar

- **Para relatório ou clipping:** filtre \`link_status = exato\`, de preferência \`verificado = sim\`.
- **\`google_news\`:** o Cortex resolve a URL real na coleta (passo "Resolve Google News links" do fetch-news). Não use esse link como evidência.
- **\`id_curto\` e \`secao\`:** não servem como link de matéria (regra 6 do playbook).
`
)
console.log(`${rows.length} notícias únicas (${records.length} registros de ${Object.keys(byOrigin).length} origens).`)
