#!/usr/bin/env node
// Quais veículos aparecem no que foi ENTREGUE ao cliente (relatórios, refeitos,
// PDFs finais, clipping do fornecedor da ONS) e não têm fonte cadastrada.
//
// Por quê: o dono quer "todas as fontes" — as que já temos mais as que
// aparecem nos clippings. A lista de faltantes sai daqui, medida, e não de
// memória. O CSV do próprio Cortex (origem cortex-csv) fica fora da conta: o
// que o Cortex coletou já tem fonte por definição.
//
// Entrada: docs/links/todas-as-noticias.csv (scripts/export-all-links.mjs) e
// docs/fontes/todas-as-fontes.csv (scripts/export-sources.mjs).
// Saída:   docs/fontes/faltantes.md
//
// Uso: node scripts/diff-outlets.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const DELIVERED_ORIGINS = new Set(['entregue', 'refeito', 'pdf-final', 'claude-chat', 'clipping-fornecedor'])

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
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
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
}

const STOP = new Set([
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das', 'e', 'online', 'noticias', 'ultimas', 'portal', 'jornal',
  'revista', 'site', 'com', 'br', 'www', 'feed', 'oficial', 'via', 'google', 'news', 'rss', 'blog', 'the',
])

function words(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !STOP.has(word))
}

// "AGÊNCIA INFRA.COM/BRASÍLIA" → "agencia infra"; praça depois da barra sai.
function outletKey(name) {
  return words(String(name).split('/')[0]).join(' ')
}

function hostOf(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^(www\d?|m|amp)\./, '')
    return host === 'news.google.com' ? null : host
  } catch {
    return null
  }
}

// Nomes do clipping que não batem por palavra com o nome cadastrado.
const ALIASES = {
  'estado s paulo': 'estadao',
  'folha s paulo': 'folha',
  'uol economia': 'uol',
  'correio web': 'correio braziliense',
  'em': 'estado minas',
  'poder 360': 'poder360',
  'agencia infra': 'agenciainfra',
  'tribuna norte': 'tribuna norte',
  'canalenergia': 'canal energia',
}

// Portais-mãe que hospedam vários veículos: cobrir um não cobre os outros.
const GENERIC_HOSTS = new Set(['globo.com', 'uol.com.br', 'abril.com.br', 'gov.br', 'com.br'])

const sources = parseCsv(readFileSync('docs/fontes/todas-as-fontes.csv', 'utf8'))
const coverage = []
for (const source of sources) {
  const hosts = new Set()
  const host = hostOf(source.url)
  if (host) hosts.add(host)
  for (const match of decodeURIComponent(source.url).matchAll(/site:([a-z0-9.\-/]+)/gi)) hosts.add(match[1].toLowerCase().replace(/^www\./, ''))
  coverage.push({ name: source.name, active: source.ativa_apos_migrations !== 'false', key: words(source.name).join(' '), hosts: [...hosts], google: /news\.google\.com/.test(source.url) })
}

function coveredBy(outlet, host) {
  const key = ALIASES[outletKey(outlet)] || outletKey(outlet)
  const compact = key.replace(/ /g, '')
  // Ativa primeiro: "MegaWhat" (009, desligada) e "MegaWhat (domínio atual)"
  // (ativa) são o mesmo veículo; só conta como desligado se não houver ativa.
  const matches = (source) => {
    // Domínio: o do link é o da fonte ou subdomínio dela. Nunca o contrário —
    // "uol.com.br" não cobre feeds.folha.uol.com.br — e nunca portal-mãe.
    if (host && source.hosts.some((h) => !GENERIC_HOSTS.has(h) && (host === h || host.endsWith(`.${h}`) || h.startsWith(`${host}/`)))) return true
    if (!key || source.google) return false
    // Nome: busca do Google News só cobre pelo `site:`, nunca pelo nome
    // ("Google News — CCEE nos grandes veículos" não é o veículo CCEE).
    const sourceCompact = source.key.replace(/ /g, '')
    if (source.key === key || sourceCompact === compact || sourceCompact.startsWith(compact) && compact.length >= 6) return true
    return source.hosts.some((h) => !GENERIC_HOSTS.has(h) && h.split('.')[0].replace(/[^a-z0-9]/g, '') === compact)
  }
  // Feed direto antes de busca do Google News: o direto traz o link exato.
  return (
    coverage.find((source) => source.active && !source.google && matches(source)) ||
    coverage.find((source) => source.active && matches(source)) ||
    coverage.find(matches)
  )
}

const links = parseCsv(readFileSync('docs/links/todas-as-noticias.csv', 'utf8'))
const outlets = new Map()
for (const row of links) {
  const origins = new Set(row.origens.split(';').map((item) => item.split(':')[0]))
  if (![...origins].some((origin) => DELIVERED_ORIGINS.has(origin))) continue
  // "Estadão / Poder360" lista dois veículos; "O GLOBO/RIO DE JANEIRO" é
  // veículo/praça (sem espaço em volta da barra) e outletKey tira a praça.
  for (const name of row.veiculo.split(/\s+\/\s+|\s*;\s*/)) {
    const host = row.link_status === 'exato' ? hostOf(row.url) : null
    const key = outletKey(name) || host
    if (!key) continue
    const label = name.split('/')[0].trim() || host
    const entry = outlets.get(key) || { name: label, hosts: new Set(), clients: new Set(), origins: new Set(), count: 0 }
    entry.count++
    if (host) entry.hosts.add(host)
    entry.clients.add(row.cliente)
    origins.forEach((origin) => DELIVERED_ORIGINS.has(origin) && entry.origins.add(origin))
    outlets.set(key, entry)
  }
}

const result = [...outlets.values()].map((entry) => {
  const hosts = [...entry.hosts]
  const match = coveredBy(entry.name, hosts[0]) || hosts.map((host) => coveredBy('', host)).find(Boolean)
  return { ...entry, hosts, match }
})
result.sort((a, b) => b.count - a.count)

const missing = result.filter((entry) => !entry.match)
const inactive = result.filter((entry) => entry.match && !entry.match.active)
const covered = result.filter((entry) => entry.match && entry.match.active)
const via = (entry) => (entry.match.google ? ' (via Google News)' : '')
const line = (entry) =>
  `| ${entry.name} | ${entry.count} | ${[...entry.clients].sort().join(', ')} | ${[...entry.origins].sort().join(', ')} | ${entry.hosts.slice(0, 2).join(' ') || '—'} |`

const md = `# Veículos entregues sem fonte cadastrada

Gerado por \`node scripts/diff-outlets.mjs\` a partir de \`docs/links/todas-as-noticias.csv\` (só origens entregues: ${[...DELIVERED_ORIGINS].join(', ')}) e \`docs/fontes/todas-as-fontes.csv\`.

**Denominador:** ${result.length} veículos distintos citados no que foi entregue (junho a outubro/2026). Cobertos por fonte ativa: ${covered.length}. Fonte cadastrada, mas desligada: ${inactive.length}. Sem fonte: ${missing.length}.

**Composição e limite.** O casamento é por domínio do link exato ou pelo nome do veículo. Um veículo citado só pelo nome, com grafia muito diferente do cadastro, pode aparecer como faltante sem estar: é piso de cobertura, não teto. "Menções" conta linhas de notícia por cliente, não matérias únicas.

## Sem fonte (ordem: mais citado primeiro)

| Veículo | Menções | Clientes | Origem | Domínio visto |
|---|---|---|---|---|
${missing.map(line).join('\n')}

## Fonte cadastrada, mas desligada

| Veículo | Menções | Clientes | Origem | Fonte desligada |
|---|---|---|---|---|
${inactive.map((entry) => `| ${entry.name} | ${entry.count} | ${[...entry.clients].sort().join(', ')} | ${[...entry.origins].sort().join(', ')} | ${entry.match.name} |`).join('\n')}

## Cobertos

${covered.map((entry) => `${entry.name} (${entry.count}) → ${entry.match.name}${via(entry)}`).join(' · ')}
`
writeFileSync('docs/fontes/faltantes.md', md)
console.log(`${result.length} veículos; ${covered.length} cobertos, ${inactive.length} desligados, ${missing.length} sem fonte.`)
