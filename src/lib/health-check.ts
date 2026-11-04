import type { SupabaseClient } from '@supabase/supabase-js'

/** Coleta roda 3x/dia; mais de 10h sem run concluído é falha, não folga. */
const MAX_HOURS_SINCE_RUN = 10
/** Telas internas respondem em poucos segundos; 20s já é sintoma do que derrubou o Painel. */
const PAGE_TIMEOUT_MS = 20_000
/** Rotas de leitura que sustentam as telas. Falhar aqui é tela em branco para o usuário. */
const PAGE_ROUTES = ['/api/dashboard?days=30', '/api/panel/hero-counts', '/api/articles?paginated=true&limit=5', '/api/agenda', '/api/clients']
/** Funções do banco que sustentam Painel e Notícias. Ausente (PGRST202) ou lenta = tela quebrada. */
const RPC_CHECKS: Array<{ name: string; args: Record<string, unknown> }> = [
  { name: 'dashboard_client_counts', args: { p_start: new Date(0).toISOString(), p_previous_start: new Date(0).toISOString() } },
  { name: 'news_hero_counts', args: { p_start: new Date(0).toISOString() } },
]
/** Dia útil sem nenhuma matéria citando o cliente indica coleta furada, não silêncio da imprensa. */
const CLIENT_SILENCE_HOURS = 30

export type HealthIssue = { kind: string; severity: 'warning' | 'critical'; title: string; details: Record<string, unknown> }

async function probe(appUrl: string, path: string): Promise<HealthIssue | null> {
  const started = Date.now()
  try {
    const res = await fetch(`${appUrl}${path}`, { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), cache: 'no-store' })
    const elapsed = Date.now() - started
    if (!res.ok) return { kind: 'health_route', severity: 'critical', title: `Rota ${path} respondeu HTTP ${res.status}`, details: { path, status: res.status, elapsed_ms: elapsed } }
    if (elapsed > PAGE_TIMEOUT_MS / 2) return { kind: 'health_route', severity: 'warning', title: `Rota ${path} lenta (${Math.round(elapsed / 1000)}s)`, details: { path, elapsed_ms: elapsed } }
    return null
  } catch (error) {
    return { kind: 'health_route', severity: 'critical', title: `Rota ${path} não respondeu`, details: { path, error: error instanceof Error ? error.message : String(error) } }
  }
}

export async function runHealthCheck(supabase: SupabaseClient, appUrl: string) {
  const issues: HealthIssue[] = []
  const probes = await Promise.all(PAGE_ROUTES.map((path) => probe(appUrl, path)))
  issues.push(...probes.filter((issue): issue is HealthIssue => Boolean(issue)))

  const { data: lastRun, error: runError } = await supabase
    .from('fetch_runs').select('id, started_at, status, error_count, total_sources')
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (runError) throw new Error(runError.message)
  const hours = lastRun ? (Date.now() - new Date(lastRun.started_at).getTime()) / 36e5 : Infinity
  if (hours > MAX_HOURS_SINCE_RUN) {
    issues.push({ kind: 'health_collection', severity: 'critical', title: `Última coleta há ${Number.isFinite(hours) ? Math.round(hours) : '∞'}h; o agendamento de 3x/dia não está rodando`, details: { last_run: lastRun?.started_at ?? null } })
  }

  const { count: failing, error: failingError } = await supabase
    .from('sources').select('id', { count: 'exact', head: true }).eq('active', true).not('last_fetch_error', 'is', null)
  if (failingError) throw new Error(failingError.message)
  if ((failing ?? 0) > 0) issues.push({ kind: 'health_sources', severity: 'warning', title: `${failing} fonte(s) ativa(s) com erro na última coleta`, details: { failing } })

  const { count: pendingLinks, error: linksError } = await supabase
    .from('articles').select('id', { count: 'exact', head: true })
    .like('url', 'https://news.google.com/%').is('resolved_url', null).lt('resolve_attempts', 3)
  if (linksError) throw new Error(linksError.message)
  if ((pendingLinks ?? 0) > 2000) issues.push({ kind: 'health_links', severity: 'warning', title: `${pendingLinks} links do Google News ainda sem URL real`, details: { pending: pendingLinks } })

  const { data: agenda, error: agendaError } = await supabase
    .from('regulatory_agenda_items').select('checked_at').eq('agency', 'ANTAQ').order('checked_at', { ascending: false }).limit(1).maybeSingle()
  if (agendaError) throw new Error(agendaError.message)
  const agendaDays = agenda ? (Date.now() - new Date(agenda.checked_at).getTime()) / 864e5 : Infinity
  if (agendaDays > 45) issues.push({ kind: 'health_agenda', severity: 'warning', title: 'Agenda da ANTAQ sem boletim novo há mais de 45 dias', details: { last_checked: agenda?.checked_at ?? null } })

  for (const check of RPC_CHECKS) {
    // Janela curta (últimas 24h) para a checagem não custar o mesmo que a tela.
    const recent = new Date(Date.now() - 86_400_000).toISOString()
    const args = Object.fromEntries(Object.keys(check.args).map((key) => [key, recent]))
    const { error } = await supabase.rpc(check.name, args)
    if (error) {
      issues.push({ kind: 'health_rpc', severity: 'critical', title: `Função ${check.name} falhou (${error.code}): ${error.code === 'PGRST202' ? 'não existe no banco ou o cache não recarregou' : error.message}`, details: { path: check.name, code: error.code } })
    }
  }

  // Cliente sem nenhuma menção direta há mais de 30h (só em dia útil).
  const weekday = new Date().getUTCDay()
  if (weekday >= 1 && weekday <= 5) {
    const since = new Date(Date.now() - CLIENT_SILENCE_HOURS * 36e5).toISOString()
    const { data: activeClients, error: clientsError } = await supabase.from('clients').select('id, name').eq('active', true)
    if (clientsError) throw new Error(clientsError.message)
    for (const client of activeClients || []) {
      const { count, error } = await supabase
        .from('article_client_tags')
        .select('article_id, articles!inner(published_at)', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('cita_cliente', true)
        .gte('articles.published_at', since)
      if (error) throw new Error(error.message)
      if (!count) {
        issues.push({ kind: 'health_client_silence', severity: 'warning', title: `${client.name}: nenhuma matéria citando o cliente nas últimas ${CLIENT_SILENCE_HOURS}h`, details: { path: client.name } })
      }
    }
  }

  const now = new Date().toISOString()
  const kinds = ['health_route', 'health_collection', 'health_sources', 'health_links', 'health_agenda', 'health_rpc', 'health_client_silence']
  // Resolve o que sarou antes de reabrir o que persiste: fingerprint estável por tipo + alvo.
  const { error: resolveError } = await supabase.from('operational_alerts')
    .update({ status: 'resolved', resolved_at: now, updated_at: now }).in('kind', kinds).neq('status', 'resolved')
  if (resolveError) throw new Error(resolveError.message)
  if (issues.length) {
    const { error: upsertError } = await supabase.from('operational_alerts').upsert(
      issues.map((issue) => ({
        fingerprint: `${issue.kind}:${String(issue.details.path ?? issue.kind)}`,
        kind: issue.kind, severity: issue.severity, status: 'open', title: issue.title, details: issue.details,
        last_seen_at: now, resolved_at: null, updated_at: now,
      })),
      { onConflict: 'fingerprint' }
    )
    if (upsertError) throw new Error(upsertError.message)
  }
  return { ok: issues.every((issue) => issue.severity !== 'critical'), issues, checked_at: now }
}
