const appUrl = (process.argv[2] || process.env.APP_URL || '').replace(/\/$/, '')

if (!appUrl) {
  console.error('Uso: npm run qa:news -- https://seu-app.vercel.app')
  process.exit(2)
}

async function getJson(path) {
  const response = await fetch(`${appUrl}${path}`)
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`${path}: ${data?.error || `HTTP ${response.status}`}`)
  }
  return data
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

async function readClientPeriod(clientId, days, options = {}) {
  const items = []
  let cursor = null
  do {
    const query = new URLSearchParams({
      paginated: 'true',
      client_id: clientId,
      limit: '200',
    })
    if (options.generatedAt) {
      const end = new Date(options.generatedAt)
      query.set('published_after', new Date(end.getTime() - days * 86400000).toISOString())
    } else {
      query.set('days', String(days))
    }
    if (options.direct) query.set('direct', 'true')
    if (options.includeContent) query.set('include_content', 'true')
    if (cursor) query.set('cursor', cursor)
    const page = await getJson(`/api/articles?${query}`)
    items.push(...page.items)
    cursor = page.next_cursor
  } while (cursor)
  return items
}

function knownFalsePositives(clientName, articles) {
  return articles.filter((article) => {
    const raw = `${article.title} ${article.excerpt || ''} ${article.content || ''}`
    const text = normalize(raw)
    if (clientName === 'ONS' && article.tag?.cita_cliente) {
      return (
        !/(?:^|[^A-Za-z0-9])ONS(?:$|[^A-Za-z0-9])/.test(raw) &&
        !text.includes('operador nacional do sistema')
      )
    }
    if (clientName.startsWith('DAQ')) {
      const road = /\b(rodovia|pavimentacao|viaduto|br \d+)\b/.test(text)
      const water =
        /\b(hidrovia|dragagem|eclusa|navegacao|aquaviario|porto fluvial)\b/.test(
          text
        )
      return road && !water
    }
    if (clientName === 'SIMINERAL') {
      const reasons = article.tag?.match_reasons || []
      return reasons.some((reason) =>
        reason.terms.some((term) => normalize(term) === 'para')
      )
    }
    return false
  })
}

const periods = [7, 15, 30]
const summaries = await Promise.all(
  periods.map((days) => getJson(`/api/dashboard?days=${days}`))
)
const primary = summaries.find((summary) => summary.period_days === 30)
const checks = []

for (const row of primary.clients) {
  const articles = await readClientPeriod(row.client.id, 30, { generatedAt: primary.generated_at })
  const directArticles = row.direct_mentions
    ? await readClientPeriod(row.client.id, 30, {
        direct: true,
        includeContent: true,
        generatedAt: primary.generated_at,
      })
    : []
  const falsePositives = knownFalsePositives(
    row.client.name,
    row.client.name === 'ONS' ? directArticles : articles
  )
  checks.push({
    client: row.client.name,
    dashboard_total: row.total,
    paginated_total: articles.length,
    direct_mentions: row.direct_mentions,
    review_count: row.review_count,
    known_false_positives: falsePositives.length,
    sample_size: Math.min(50, articles.length),
  })
}

console.log('# QA de notícias\n')
console.log(`Gerado em ${new Date().toISOString()} para ${appUrl}.\n`)
console.log('| Cliente | 7 dias | 15 dias | 30 dias | Diretas | Revisão | Divergência | Falsos positivos conhecidos |')
console.log('|---|---:|---:|---:|---:|---:|---:|---:|')
for (const check of checks) {
  const totals = periods.map(
    (days) =>
      summaries
        .find((summary) => summary.period_days === days)
        .clients.find((row) => row.client.name === check.client)?.total || 0
  )
  console.log(
    `| ${check.client} | ${totals[0]} | ${totals[1]} | ${totals[2]} | ${check.direct_mentions} | ${check.review_count} | ${check.dashboard_total - check.paginated_total} | ${check.known_false_positives} |`
  )
}

console.log('\n## Saúde da coleta\n')
console.log(JSON.stringify(primary.health, null, 2))

const failures = checks.filter(
  (check) =>
    check.dashboard_total !== check.paginated_total ||
    check.known_false_positives > 0
)
if (failures.length) {
  console.error(
    `\nQA reprovado para: ${failures.map((check) => check.client).join(', ')}`
  )
  process.exit(1)
}
console.log('\nQA aprovado: contagens integrais e regressões conhecidas sem divergência.')
