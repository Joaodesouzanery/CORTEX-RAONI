#!/usr/bin/env node
// Auditoria externa dos relatórios entregues (jun–out/2026), a partir do
// gabarito extraído por scripts/extract-report-evidence.mjs.
//
// Parte 1 (sem banco): qualidade do que foi entregue — volume por mês, link
// ausente, veículo que não bate com o domínio do link, data do link fora do mês.
// Parte 2 (opcional, com --cortex arquivo.json): o que o Cortex capturou. O
// arquivo vem da rota interna /api/internal/audit (GitHub Actions), para não
// exigir chave do Supabase na máquina.
//
// Uso: node scripts/audit-reports.mjs [gabarito.json] [--cortex captura.json]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const gabaritoPath = args.find((arg) => arg.endsWith('.json') && !arg.startsWith('--')) || 'docs/referencia-relatorios/gabarito.json'
const cortexIndex = args.indexOf('--cortex')
const cortex = cortexIndex >= 0 ? JSON.parse(readFileSync(args[cortexIndex + 1], 'utf8')) : null
const outDir = 'docs/auditoria'

const gabarito = JSON.parse(readFileSync(gabaritoPath, 'utf8'))

// Veículo declarado → trechos de domínio aceitos. Só os grandes; o resto é
// comparado por palavra do nome contra o domínio.
const OUTLET_DOMAINS = {
  'valor': ['valor.globo.com', 'valor.com.br'],
  'o globo': ['oglobo.globo.com'],
  'g1': ['g1.globo.com'],
  'estadão': ['estadao.com.br'],
  'estadao': ['estadao.com.br'],
  'folha': ['folha.uol.com.br'],
  'cnn': ['cnnbrasil.com.br'],
  'eixos': ['eixos.com.br'],
  'poder360': ['poder360.com.br'],
  'infomoney': ['infomoney.com.br'],
  'agência brasil': ['agenciabrasil.ebc.com.br'],
  'agência infra': ['agenciainfra.com'],
  'agência senado': ['senado.leg.br'],
  'canal energia': ['canalenergia.com.br'],
  'megawhat': ['megawhat.energy'],
  'cenário energia': ['cenarioenergia.com.br'],
}

const normalizeWord = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

export function outletMatchesUrl(outlet, url) {
  if (!outlet || !url) return null
  const host = new URL(url).hostname.replace(/^www\./, '')
  const lower = outlet.toLowerCase()
  const known = Object.entries(OUTLET_DOMAINS).find(([name]) => lower.includes(name))
  if (known) return known[1].some((domain) => host.endsWith(domain))
  // Veículo desconhecido: aceita se alguma palavra (4+ letras) do nome está no domínio.
  const words = lower.split(/[\s—–\-()/.]+/).map(normalizeWord).filter((word) => word.length >= 4)
  if (!words.length) return null
  return words.some((word) => normalizeWord(host).includes(word))
}

// Data embutida no caminho (/2026/04/, /2026-04/, 20260412) fora do mês do relatório.
export function urlMonth(url) {
  const match = url.match(/\/(20\d\d)[/-](\d{2})(?:[/-]|$)/) || url.match(/(20\d\d)(\d{2})\d{2}/)
  return match ? `${match[1]}-${match[2]}` : null
}

const byClient = new Map()
for (const report of gabarito.reports) {
  if (!byClient.has(report.client)) byClient.set(report.client, [])
  byClient.get(report.client).push(report)
}

const summary = []
mkdirSync(outDir, { recursive: true })
for (const [client, reports] of [...byClient.entries()].sort()) {
  const lines = [`# ${client} — auditoria dos relatórios entregues`, '']
  lines.push('| Mês | Versão | Itens | Com link | Veículo ≠ link | Link de outro mês | Capturados pelo Cortex |', '|---|---|---|---|---|---|---|')
  const problems = []
  for (const report of reports.sort((a, b) => a.period.localeCompare(b.period))) {
    const withLink = report.items.filter((item) => item.url)
    const mismatched = withLink.filter((item) => outletMatchesUrl(item.outlet, item.url) === false)
    const otherMonth = withLink.filter((item) => {
      const month = urlMonth(item.url)
      return month && month !== report.period
    })
    const capturedSet = cortex?.captured?.[client]?.[report.period]
    const captured = capturedSet ? withLink.filter((item) => capturedSet.includes(item.url)).length : null
    lines.push(
      `| ${report.period} | ${report.variant} | ${report.items.length} | ${withLink.length} | ${mismatched.length} | ${otherMonth.length} | ${captured == null ? 'sem medição' : `${captured}/${withLink.length}`} |`
    )
    for (const item of mismatched) problems.push(`- **${report.period}** — veículo "${item.outlet}" mas o link é de \`${new URL(item.url).hostname}\`: ${item.title} — ${item.url}`)
    for (const item of otherMonth) problems.push(`- **${report.period}** — link datado de ${urlMonth(item.url)}: ${item.title} — ${item.url}`)
    summary.push({ client, period: report.period, variant: report.variant, items: report.items.length, links: withLink.length, mismatched: mismatched.length, otherMonth: otherMonth.length, captured })
  }
  lines.push('', '## Pontos a corrigir nos links entregues', '', problems.length ? problems.join('\n') : 'Nenhum problema automático encontrado.', '')
  lines.push('## Notícias identificadas (base para refazer o relatório)', '')
  for (const report of reports) {
    lines.push(`### ${report.period} (${report.variant})`, '')
    for (const item of report.items) {
      const date = item.date ? item.date.split('-').reverse().slice(0, 2).join('/') : report.period
      lines.push(`- ${date} · ${item.outlet || 'veículo não informado'} · ${item.url ? `[${item.title}](${item.url})` : `${item.title} _(sem link)_`}${item.tone ? ` · ${item.tone}` : ''}`)
    }
    lines.push('')
  }
  writeFileSync(join(outDir, `${client}.md`), lines.join('\n'))
}

const total = summary.reduce((acc, row) => ({ items: acc.items + row.items, links: acc.links + row.links, mismatched: acc.mismatched + row.mismatched, otherMonth: acc.otherMonth + row.otherMonth }), { items: 0, links: 0, mismatched: 0, otherMonth: 0 })
const resumo = [
  '# Auditoria dos relatórios entregues — resumo',
  '',
  `Fonte: ${gabarito.reports.length} relatórios em \`docs/referencia-relatorios/modelo/\`, ${total.items} itens de evidência, ${total.links} com link.`,
  '',
  '| Cliente | Mês | Versão | Itens | Com link | Veículo ≠ link | Link de outro mês |',
  '|---|---|---|---|---|---|---|',
  ...summary.map((row) => `| ${row.client} | ${row.period} | ${row.variant} | ${row.items} | ${row.links} | ${row.mismatched} | ${row.otherMonth} |`),
  '',
  `Total: ${total.mismatched} links cujo domínio não é o veículo citado e ${total.otherMonth} links datados de outro mês. Os dois violam a regra 6 do playbook ("link só quando a URL corresponde exatamente à matéria").`,
  '',
  'Detalhe por cliente em `docs/auditoria/<CLIENTE>.md`.',
  '',
]
writeFileSync(join(outDir, 'RESUMO.md'), resumo.join('\n'))
console.log(resumo.join('\n'))
