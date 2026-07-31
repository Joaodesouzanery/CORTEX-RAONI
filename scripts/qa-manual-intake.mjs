const appUrl = (process.argv[2] || process.env.APP_URL || '').replace(/\/$/, '')

if (!appUrl) {
  console.error('Uso: npm run qa:manual-intake -- https://seu-app.vercel.app')
  process.exit(2)
}

async function getJson(path) {
  const response = await fetch(`${appUrl}${path}`)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${path}: ${data?.error || `HTTP ${response.status}`}`)
  return data
}

const clients = await getJson('/api/clients?active=true')
const ons = clients.find((client) => client.name === 'ONS')
if (!ons) throw new Error('Cliente ONS não encontrado.')

const base = new URLSearchParams({
  paginated: 'true',
  client_id: ons.id,
  origin: 'manual',
  limit: '200',
})
const items = []
let cursor = null
let reportedTotal = 0
do {
  const query = new URLSearchParams(base)
  if (cursor) query.set('cursor', cursor)
  const page = await getJson(`/api/articles?${query}`)
  reportedTotal = page.total
  items.push(...page.items)
  cursor = page.next_cursor
} while (cursor)

const summaryQuery = new URLSearchParams({ client_id: ons.id, origin: 'manual' })
const summary = await getJson(`/api/articles/summary?${summaryQuery}`)
const ids = new Set(items.map((article) => article.id))
const unmarked = items.filter((article) => article.tag?.manual_intake !== true)
const referenceLeak = items.filter((article) => /(?:simineral\s*-->\s*)?claude\.pdf/i.test(article.title))
const beloMonte = items.filter((article) => /belo monte fecha primeiro semestre/i.test(article.title))

console.log('# QA de notícias enviadas manualmente\n')
console.log(`Gerado em ${new Date().toISOString()} para ${appUrl}.\n`)
console.log(`- Total paginado: ${items.length}`)
console.log(`- Total informado pela API: ${reportedTotal}`)
console.log(`- Total do panorama: ${summary.total}`)
console.log(`- IDs únicos: ${ids.size}`)
console.log(`- Itens sem marca manual: ${unmarked.length}`)
console.log(`- Relatórios de referência na lista: ${referenceLeak.length}`)
console.log(`- Ocorrências únicas de Belo Monte: ${beloMonte.length}`)

const failures = [
  items.length !== reportedTotal,
  items.length !== summary.total,
  ids.size !== items.length,
  unmarked.length > 0,
  referenceLeak.length > 0,
  beloMonte.length > 1,
]
if (failures.some(Boolean)) {
  console.error('\nQA reprovado para a lista “Enviadas por mim”.')
  process.exit(1)
}
console.log('\nQA aprovado: lista integral, sem duplicatas e sem relatórios de referência.')

