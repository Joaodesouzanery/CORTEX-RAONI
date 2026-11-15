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
  for (const match of sql.matchAll(/\(\s*'((?:[^']|'')+)'\s*,\s*'(https?:\/\/(?:[^']|'')+)'\s*,\s*'(rss|scrape|api|html|sitemap)'\s*,\s*(true|false)(?:\s*,\s*(true|false))?/gi)) {
    const [, rawName, rawUrl, type, active, general] = match
    const name = rawName.replace(/''/g, "'")
    const url = rawUrl.replace(/''/g, "'")
    sources.set(url, { name, url, type, active_na_migration: active, ativa_apos_migrations: active, is_general: general ?? '', migration: file })
  }
  // Ativações e desativações posteriores, na ordem das migrations. Sem isto o
  // catálogo mostrava como ativa a fonte que a 042/043/056 desligaram.
  const setActive = (predicate, value) => {
    for (const source of sources.values()) if (predicate(source)) source.ativa_apos_migrations = value
  }
  const quoted = (text) => [...text.matchAll(/'((?:[^']|'')+)'/g)].map((m) => m[1].replace(/''/g, "'"))
  for (const match of sql.matchAll(/UPDATE sources SET active = (TRUE|FALSE)\s+WHERE name = '((?:[^']|'')+)'/gi)) {
    const name = match[2].replace(/''/g, "'")
    setActive((source) => source.name === name, match[1].toLowerCase())
  }
  for (const match of sql.matchAll(/UPDATE sources SET active = (TRUE|FALSE)\s+WHERE name IN \(([\s\S]*?)\)/gi)) {
    const names = new Set(quoted(match[2]))
    setActive((source) => names.has(source.name), match[1].toLowerCase())
  }
  for (const match of sql.matchAll(/UPDATE sources SET active = (TRUE|FALSE)\s+WHERE url IN \(([\s\S]*?)\)/gi)) {
    const urls = new Set(quoted(match[2]))
    setActive((source) => urls.has(source.url), match[1].toLowerCase())
  }
  // Troca de URL por nome (025: feeds quebrados viraram busca Google News).
  for (const match of sql.matchAll(/UPDATE sources SET\s+url = '((?:[^']|'')+)'[^;]*?WHERE name = '((?:[^']|'')+)'/gi)) {
    const url = match[1].replace(/''/g, "'")
    const name = match[2].replace(/''/g, "'")
    const existing = [...sources.entries()].filter(([, source]) => source.name === name)
    for (const [oldUrl, source] of existing) {
      sources.delete(oldUrl)
      sources.set(url, { ...source, url })
    }
    // Fonte criada fora das migrations (cadastro antigo pela tela) que uma
    // migration depois corrigiu: entra no catálogo com a situação "a conferir".
    if (!existing.length) {
      sources.set(url, { name, url, type: 'rss', active_na_migration: '', ativa_apos_migrations: 'conferir no banco', is_general: '', migration: file })
    }
  }
  // Consolidação de duplicatas (042, 056): pares (url_antiga, url_mantida); a
  // antiga só desliga se a mantida existe e está ativa.
  if (/UPDATE sources old\s+SET active = FALSE/i.test(sql)) {
    for (const match of sql.matchAll(/\(\s*'(https?:\/\/[^']+)'\s*,\s*'(https?:\/\/[^']+)'\s*\)/g)) {
      const keep = sources.get(match[2])
      const old = sources.get(match[1])
      if (keep && old && keep.ativa_apos_migrations !== 'false') old.ativa_apos_migrations = 'false'
    }
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
const header = ['name', 'url', 'type', 'active_na_migration', 'ativa_apos_migrations', 'is_general', 'clientes', 'situacao', 'migration']
mkdirSync('docs/fontes', { recursive: true })
writeFileSync('docs/fontes/todas-as-fontes.csv', `${[header.join(','), ...rows.map((row) => header.map((field) => csvCell(row[field])).join(','))].join('\n')}\n`)
console.log(`${rows.length} fontes; ${rows.filter((row) => row.clientes).length} com cliente vinculado.`)
