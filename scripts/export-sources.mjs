#!/usr/bin/env node
// Catálogo de todas as fontes cadastradas pelas migrations, com o feed de cada
// uma e os clientes vinculados. Gera docs/fontes/todas-as-fontes.csv.
// O banco é a verdade sobre o que está ativo hoje: confira com
// docs/fontes/consulta-fontes-ativas.sql.
//
// Uso: node scripts/export-sources.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = 'supabase/migrations'
const sources = new Map()
const links = new Map()

// Situação conhecida (docs/fontes-bloqueadas.md, testes de 04/11/2026).
const STATUS = [
  [/brasilenergia/i, 'bloqueada (403)'],
  [/sindinfor\.org\.br/i, 'pode bloquear automação (406 visto na conferência)'],
  [/valor\.globo|estadao|folha|oglobo/i, 'feed ok; texto atrás de paywall'],
  [/news\.google\.com/i, 'busca Google News (link precisa ser resolvido)'],
]

for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
  // Tuplas de INSERT INTO sources: ('Nome', 'https://feed', 'rss', true, ...
  for (const match of sql.matchAll(/\(\s*'((?:[^']|'')+)'\s*,\s*'(https?:\/\/(?:[^']|'')+)'\s*,\s*'(rss|scrape|api|html|sitemap)'\s*,\s*(true|false)\s*,\s*(true|false)?/gi)) {
    const [, rawName, rawUrl, type, active, general] = match
    const name = rawName.replace(/''/g, "'")
    const url = rawUrl.replace(/''/g, "'")
    sources.set(url, { name, url, type, active_na_migration: active, is_general: general ?? '', migration: file })
  }
  // Desativações explícitas por nome.
  for (const match of sql.matchAll(/UPDATE sources SET active = (TRUE|FALSE) WHERE name = '((?:[^']|'')+)'/gi)) {
    for (const source of sources.values()) if (source.name === match[2].replace(/''/g, "'")) source.active_na_migration = match[1].toLowerCase()
  }
  // Vínculos cliente ↔ fonte nas migrations no formato ('CLIENTE', 'Nome da fonte').
  if (/INSERT INTO client_sources/i.test(sql)) {
    for (const match of sql.matchAll(/\(\s*'([A-Z%][A-Z%]*)'\s*,\s*'((?:[^']|'')+)'\s*\)/g)) {
      const name = match[2].replace(/''/g, "'")
      if (!links.has(name)) links.set(name, new Set())
      links.get(name).add(match[1].replace('%', ''))
    }
    const block = sql.match(/client\.name IN \(([^)]+)\)[\s\S]*?source\.name IN \(([\s\S]+?)\)\s*\n/)
    if (block) {
      const clientNames = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      for (const sourceMatch of block[2].matchAll(/'((?:[^']|'')+)'/g)) {
        const name = sourceMatch[1].replace(/''/g, "'")
        if (!links.has(name)) links.set(name, new Set())
        clientNames.forEach((client) => links.get(name).add(client))
      }
    }
  }
}

const rows = [...sources.values()].map((source) => ({
  ...source,
  clientes: [...(links.get(source.name) || [])].sort().join(' | '),
  situacao: STATUS.find(([pattern]) => pattern.test(source.url))?.[1] ?? '',
}))
rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

const csvCell = (value) => {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
const header = ['name', 'url', 'type', 'active_na_migration', 'is_general', 'clientes', 'situacao', 'migration']
mkdirSync('docs/fontes', { recursive: true })
writeFileSync('docs/fontes/todas-as-fontes.csv', `${[header.join(','), ...rows.map((row) => header.map((field) => csvCell(row[field])).join(','))].join('\n')}\n`)
console.log(`${rows.length} fontes; ${rows.filter((row) => row.clientes).length} com cliente vinculado.`)
