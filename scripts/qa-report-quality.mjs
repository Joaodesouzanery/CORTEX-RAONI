const appUrl = (process.argv[2] || process.env.APP_URL || '').replace(/\/$/, '')
const period = process.argv[3] || '2026-07'

if (!appUrl) {
  console.error('Uso: npm run qa:qualification -- https://seu-app.vercel.app 2026-07')
  process.exit(2)
}

async function getJson(path) {
  const response = await fetch(`${appUrl}${path}`)
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(`${path}: ${data?.error || `HTTP ${response.status}`}`)
  return data
}

const clients = await getJson('/api/clients?active=true')
const simineral = clients.find((client) => client.name === 'SIMINERAL')
if (!simineral) throw new Error('Cliente SIMINERAL não encontrado.')

const [year, month] = period.split('-').map(Number)
const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
const queryBase = new URLSearchParams({
  client_id: simineral.id,
  published_after: `${period}-01T03:00:00.000Z`,
  published_before: `${next}T02:59:59.999Z`,
})
const summary = await getJson(`/api/articles/summary?${queryBase}`)
const items = []
let cursor = null
do {
  const query = new URLSearchParams(queryBase)
  query.set('paginated', 'true')
  query.set('limit', '200')
  if (cursor) query.set('cursor', cursor)
  const page = await getJson(`/api/articles?${query}`)
  items.push(...page.items)
  cursor = page.next_cursor
} while (cursor)

const noise = /\b(bitcoin|criptomoeda|ibovespa|vale3|cmin3|day trade|carteira recomendada|wano|ansn)\b/i
const qualifiedNoise = items.filter(
  (article) => {
    const tag = article.tag
    const qualified =
      tag?.report_role === 'evidencia' &&
      (tag.report_role_source === 'humano' ||
        tag.editorial_review_state === 'revisado' ||
        (tag.verification_status === 'verificada' &&
          tag.qa_checked_at &&
          Number(tag.editorial_confidence || 0) >= 0.85))
    return qualified && noise.test(`${article.title} ${article.excerpt || ''}`)
  }
)
const geography = items.reduce((counts, article) => {
  const key = article.tag?.geographic_scope || 'não classificado'
  counts[key] = (counts[key] || 0) + 1
  return counts
}, {})
const flags = items.reduce((counts, article) => {
  for (const flag of article.tag?.quality_flags || []) counts[flag] = (counts[flag] || 0) + 1
  return counts
}, {})
const sourceVerification = items.reduce((counts, article) => {
  const key = article.tag?.source_verification_status || 'nao_verificada'
  counts[key] = (counts[key] || 0) + 1
  return counts
}, {})

console.log(`# QA de qualificação — SIMINERAL ${period}\n`)
console.log(`Gerado em ${new Date().toISOString()} para ${appUrl}.\n`)
console.log('## Funil\n')
console.log(JSON.stringify(summary.funnel, null, 2))
console.log('\n## Escopo geográfico\n')
console.log(JSON.stringify(geography, null, 2))
console.log('\n## Indicadores de qualidade\n')
console.log(JSON.stringify(flags, null, 2))
console.log('\n## Conferência das fontes\n')
console.log(JSON.stringify(sourceVerification, null, 2))
console.log(`\nRuídos conhecidos promovidos como evidência: ${qualifiedNoise.length}.`)
for (const article of qualifiedNoise.slice(0, 20)) console.log(`- ${article.title}`)

const inconsistent = summary.total !== items.length
const emptyTriage = summary.total > 0 && Number(summary.funnel?.triaged || 0) === 0
const emptyQualifiedBase = summary.total > 0 && Number(summary.funnel?.qualified || 0) === 0
const noVerifiedSource = summary.total > 0 &&
  Number(sourceVerification.fonte_original || 0) + Number(sourceVerification.documento_integral || 0) === 0
if (emptyTriage) console.error('\nFalha: nenhuma ocorrência foi triada; o funil ainda não sustenta um relatório.')
if (emptyQualifiedBase) console.error('Falha: a Base Qualificada está vazia.')
if (noVerifiedSource) console.error('Falha: nenhuma evidência possui fonte ou documento integral verificado.')
if (qualifiedNoise.length || inconsistent || emptyTriage || emptyQualifiedBase || noVerifiedSource) process.exit(1)
console.log('\nQA aprovado: funil integral e nenhum ruído conhecido promovido automaticamente.')
