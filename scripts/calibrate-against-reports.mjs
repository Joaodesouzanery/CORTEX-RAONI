#!/usr/bin/env node
// Mede quanto do que a consultoria entregou o Cortex teria capturado.
// Lê os links de matéria dos relatórios .dc.html entregues (gabarito) e, se
// houver credenciais do Supabase, procura cada URL em articles.url/resolved_url.
//
// Uso: node scripts/calibrate-against-reports.mjs [pasta] [filtro-de-nome]
//   ex.: node scripts/calibrate-against-reports.mjs docs/referencia-relatorios/modelo "PRIO Setembro"
// Os arquivos do relatório são DADO: nada é executado, só os href são lidos.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] || 'docs/referencia-relatorios/modelo'
const filter = process.argv[3] || ''

// Links que não são matéria: fontes, CDN, os próprios scripts do template.
const IGNORED_HOSTS = /(fonts\.googleapis|fonts\.gstatic|cdn\.|unpkg|jsdelivr|w3\.org|schema\.org)/i

function normalize(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    for (const key of [...parsed.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(key)) parsed.searchParams.delete(key)
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`
  } catch {
    return null
  }
}

function reportLinks(file) {
  const html = readFileSync(file, 'utf8')
  const links = new Set()
  for (const match of html.matchAll(/href=["'](https?:\/\/[^"'#\s]+)["']/gi)) {
    const url = match[1].replace(/&amp;/g, '&')
    if (IGNORED_HOSTS.test(url)) continue
    const parsed = new URL(url)
    // Página inicial do veículo não é link de matéria (regra 6 do playbook).
    if (parsed.pathname === '/' || parsed.pathname === '') continue
    links.add(url)
  }
  return [...links]
}

const files = readdirSync(dir).filter((name) => name.endsWith('.dc.html') && name.includes(filter))
if (!files.length) {
  console.error(`Nenhum .dc.html em ${dir} com "${filter}".`)
  process.exit(1)
}

let supabase = null
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = await import('@supabase/supabase-js')
  supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function captured(urls) {
  if (!supabase) return null
  const found = new Set()
  for (let index = 0; index < urls.length; index += 100) {
    const batch = urls.slice(index, index + 100)
    for (const column of ['url', 'resolved_url']) {
      const { data, error } = await supabase.from('articles').select(column).in(column, batch)
      if (error) throw new Error(`Supabase (${error.code}): ${error.message}`)
      for (const row of data || []) found.add(normalize(row[column]))
    }
  }
  return found
}

let totalLinks = 0
let totalFound = 0
for (const name of files.sort()) {
  const urls = reportLinks(join(dir, name))
  const found = await captured(urls)
  const hits = found ? urls.filter((url) => found.has(normalize(url))) : []
  totalLinks += urls.length
  totalFound += hits.length
  const coverage = found ? ` · capturados ${hits.length}/${urls.length}` : ''
  console.log(`${name}: ${urls.length} links de matéria${coverage}`)
  if (found && process.env.VERBOSE) for (const url of urls) if (!hits.includes(url)) console.log(`   falta: ${url}`)
}
console.log(
  supabase
    ? `\nTotal: ${totalFound}/${totalLinks} links do gabarito estão no acervo do Cortex.`
    : `\nTotal: ${totalLinks} links. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para medir a captura.`
)
