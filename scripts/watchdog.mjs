#!/usr/bin/env node
// Vigia de saúde que NÃO depende do app que ele vigia (Fase 21).
//
// Por quê: de 15/09 a 14/11/2026 a coleta agendada falhou em todas as 100
// execuções (APP_URL apontava para um deploy apagado, DEPLOYMENT_NOT_FOUND) e
// nenhum alerta disparou — a checagem de saúde era um passo do mesmo
// workflow quebrado e gravava pelo mesmo app. Este script roda no GitHub
// Actions (.github/workflows/watchdog.yml) e olha direto:
//   1. o GitHub: as últimas execuções de cada workflow agendado;
//   2. as URLs: APP_URL (o que os workflows chamam) e o domínio de produção;
//   3. o Supabase pela REST, com a chave de serviço: idade e status da última
//      coleta, fontes com erro ou paradas, links do Google News pendentes.
// Resultado: resumo no job, uma Issue com o rótulo `saude` aberta/atualizada
// (fechada quando sara) e e-mail pelo Resend quando a Issue é aberta.
// Sai com código 1 se houver crítico, para o GitHub também avisar.
//
// Sem dependências: Node 20 (fetch nativo).

const env = process.env
const PROD_URL = (env.PROD_URL || 'https://cortexreputacional.vercel.app').replace(/\/$/, '')
const APP_URL = (env.APP_URL || '').replace(/\/$/, '')
const REPO = env.GITHUB_REPOSITORY
const GH_TOKEN = env.GITHUB_TOKEN
const SUPABASE_URL = (env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
// Limiares (mesmos de src/lib/collection-health.ts e src/lib/health-check.ts).
const MAX_HOURS_SINCE_RUN = 14 // maior intervalo do cron (21h→10h UTC) + 1 h
const STALE_SOURCE_HOURS = 72 // fonte ativa sem item novo há 3 dias
const MAX_PENDING_LINKS = 2000
const WATCHED_WORKFLOWS = ['fetch-news.yml']
const ISSUE_LABEL = 'saude'

const issues = [] // { severity: 'critical'|'warning', area, title, detail }
const add = (severity, area, title, detail = '') => issues.push({ severity, area, title, detail })

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (!res.ok) throw new Error(`GitHub ${path}: HTTP ${res.status}`)
  return res.status === 204 ? null : res.json()
}

async function checkWorkflows() {
  for (const workflow of WATCHED_WORKFLOWS) {
    try {
      const data = await gh(`/actions/workflows/${workflow}/runs?status=completed&per_page=3`)
      const runs = data.workflow_runs || []
      if (!runs.length) {
        add('warning', 'workflows', `${workflow}: nenhuma execução concluída encontrada`)
        continue
      }
      const failures = runs.slice(0, 2).filter((run) => run.conclusion === 'failure')
      if (failures.length === 2) {
        add('critical', 'workflows', `${workflow}: as duas últimas execuções falharam`, `Última: ${runs[0].html_url} (${runs[0].created_at})`)
      }
      const hours = (Date.now() - new Date(runs[0].created_at).getTime()) / 36e5
      if (hours > MAX_HOURS_SINCE_RUN) add('critical', 'workflows', `${workflow}: sem execução há ${Math.round(hours)}h (agendamento desligado?)`)
    } catch (error) {
      add('warning', 'workflows', `Não consegui ler as execuções de ${workflow}`, error.message)
    }
  }
}

async function probe(label, base) {
  if (!base) {
    add('critical', 'deploy', `${label} não está definido nos segredos do GitHub`)
    return
  }
  try {
    const res = await fetch(`${base}/api/clients`, { signal: AbortSignal.timeout(20_000) })
    const body = res.ok ? '' : (await res.text().catch(() => '')).slice(0, 200)
    if (!res.ok) {
      const hint = /DEPLOYMENT_NOT_FOUND/.test(body) ? ' — endereço de um deploy que não existe mais; aponte para o domínio de produção' : ''
      add('critical', 'deploy', `${label} respondeu HTTP ${res.status}${hint}`, body.replace(/\s+/g, ' '))
    }
  } catch (error) {
    add('critical', 'deploy', `${label} não respondeu`, error.message)
  }
}

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' },
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Supabase ${path.split('?')[0]}: HTTP ${res.status}`)
  const range = res.headers.get('content-range') || ''
  return { rows: await res.json(), count: Number(range.split('/')[1]) || 0 }
}

async function checkDatabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    add('warning', 'banco', 'Segredos SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ausentes no GitHub: o vigia não consegue olhar a coleta no banco')
    return
  }
  try {
    const { rows: runs } = await sb('fetch_runs?select=id,started_at,status,error_count,total_sources&order=started_at.desc&limit=1')
    const last = runs[0]
    const hours = last ? (Date.now() - new Date(last.started_at).getTime()) / 36e5 : Infinity
    if (hours > MAX_HOURS_SINCE_RUN) add('critical', 'coleta', `Última coleta gravada no banco há ${Number.isFinite(hours) ? Math.round(hours) : '∞'}h`)
    else if (last?.status === 'erro') add('critical', 'coleta', `A última coleta terminou em erro (${last.error_count} de ${last.total_sources} fontes)`)

    const { rows: failing, count: failingCount } = await sb('sources?select=name&active=eq.true&last_fetch_error=not.is.null&order=name&limit=20')
    if (failingCount) add('warning', 'fontes', `${failingCount} fonte(s) ativa(s) com erro`, failing.map((row) => row.name).join(', '))

    const staleSince = new Date(Date.now() - STALE_SOURCE_HOURS * 36e5).toISOString()
    const { rows: stale, count: staleCount } = await sb(`sources?select=name&active=eq.true&or=(last_success_at.is.null,last_success_at.lt.${staleSince})&order=name&limit=20`)
    if (staleCount) add('warning', 'fontes', `${staleCount} fonte(s) ativa(s) sem item novo há mais de ${STALE_SOURCE_HOURS}h`, stale.map((row) => row.name).join(', '))

    const { count: pending } = await sb('articles?select=id&url=like.https://news.google.com/*&resolved_url=is.null&resolve_attempts=lt.3&limit=1')
    if (pending > MAX_PENDING_LINKS) add('warning', 'links', `${pending} links do Google News sem URL real`)
  } catch (error) {
    add('critical', 'banco', 'Não consegui consultar o Supabase', error.message)
  }
}

function report() {
  const critical = issues.filter((issue) => issue.severity === 'critical')
  const lines = [
    `# Vigia de saúde do Cortex — ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    issues.length ? `**${critical.length} crítico(s), ${issues.length - critical.length} aviso(s).**` : '**Tudo certo.** Coleta, workflows, deploy e banco sem problema.',
    '',
    ...issues.map((issue) => `- ${issue.severity === 'critical' ? '🔴' : '🟡'} **${issue.area}** — ${issue.title}${issue.detail ? `\n  ${issue.detail}` : ''}`),
    '',
    'Como diagnosticar: skill `saude-dos-workflows`, `saude-do-deploy` e `saude-da-coleta` em `.claude/skills/`.',
  ]
  return { text: lines.join('\n'), critical: critical.length }
}

async function syncIssue(text, hasProblems) {
  if (!GH_TOKEN || !REPO) return { opened: false }
  const open = await gh(`/issues?state=open&labels=${ISSUE_LABEL}&per_page=1`)
  const current = open[0]
  if (!hasProblems) {
    if (current) {
      await gh(`/issues/${current.number}/comments`, { method: 'POST', body: JSON.stringify({ body: 'Sarou: a última verificação do vigia não encontrou problema.' }) })
      await gh(`/issues/${current.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) })
    }
    return { opened: false }
  }
  if (current) {
    await gh(`/issues/${current.number}`, { method: 'PATCH', body: JSON.stringify({ body: text }) })
    return { opened: false, url: current.html_url }
  }
  const created = await gh('/issues', { method: 'POST', body: JSON.stringify({ title: 'Saúde do Cortex: problema detectado pelo vigia', body: text, labels: [ISSUE_LABEL] }) })
  return { opened: true, url: created.html_url }
}

async function email(text, url) {
  if (!env.RESEND_API_KEY || !env.ALERTS_EMAIL_TO) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.ALERTS_EMAIL_FROM || 'CORTEX <onboarding@resend.dev>',
      to: env.ALERTS_EMAIL_TO.split(',').map((item) => item.trim()).filter(Boolean),
      subject: 'Cortex: o vigia de saúde encontrou problema',
      text: `${text}\n\n${url || ''}`,
    }),
  })
  if (!res.ok) console.error(`E-mail do vigia falhou: HTTP ${res.status}`)
}

await checkWorkflows()
await probe('APP_URL (endereço que os workflows chamam)', APP_URL)
if (PROD_URL !== APP_URL) await probe(`Produção (${PROD_URL})`, PROD_URL)
await checkDatabase()

const { text, critical } = report()
console.log(text)
if (env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)
}
try {
  const issue = await syncIssue(text, issues.length > 0)
  // E-mail só quando a Issue abre: o vigia roda a cada 3 h e não pode virar spam.
  if (issue.opened && critical) await email(text, issue.url)
} catch (error) {
  console.error(`Não consegui abrir/atualizar a Issue: ${error.message}`)
}
process.exit(critical ? 1 : 0)
