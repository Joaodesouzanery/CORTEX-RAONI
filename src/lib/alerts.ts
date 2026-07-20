import type { Tom, Relevancia } from '@/types'

// Continuous alerts — the deterministic layer that turns passive accumulation
// into proactive intelligence (the "retainer maker"). Pure module: no React /
// Supabase / AI, so it runs in the cron route and in Vitest. The API route
// prepares each client's recent window (tom/relevância from tags or the
// heuristic classifier) + a baseline, and this decides what's worth alerting.

export interface AlertArticle {
  title: string
  url: string
  veiculo: string
  published_at: string | null
  tom?: Tom | null
  relevancia?: Relevancia | null
}

export type AlertType = 'pico_volume' | 'sentimento_negativo' | 'alta_relevancia'
export type AlertSeverity = 'alta' | 'media' | 'info'

export interface Alert {
  type: AlertType
  severity: AlertSeverity
  message: string
  count: number
  items: AlertArticle[]
}

export interface ClientDigest {
  clientName: string
  alerts: Alert[]
  recipient?: string | null
}

export interface AlertThresholds {
  spikeMultiplier: number // recent count must reach baselineDailyAvg × this…
  spikeMinItems: number // …and be at least this many (avoids tiny-baseline noise)
  negativeMin: number // ≥ this many neg/crítico items → alert
  negativeHigh: number // ≥ this many → severity "alta"
  topItems: number // items to attach per alert (for the digest)
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  spikeMultiplier: 2,
  spikeMinItems: 6,
  negativeMin: 3,
  negativeHigh: 6,
  topItems: 5,
}

const isNegative = (a: AlertArticle) => a.tom === 'negativo' || a.tom === 'critico'

/**
 * Decide the alerts for ONE client's recent window.
 * @param recent items in the alert window (e.g. last 24h), already client-relevant, each with tom/relevância.
 * @param baselineDailyAvg average daily count of relevant items over the baseline window.
 */
export function computeAlerts(
  recent: AlertArticle[],
  baselineDailyAvg: number,
  th: AlertThresholds = DEFAULT_THRESHOLDS
): Alert[] {
  const alerts: Alert[] = []

  // 1) Volume spike vs. the client's own baseline.
  const spikeFloor = Math.max(th.spikeMinItems, Math.ceil(baselineDailyAvg * th.spikeMultiplier))
  if (recent.length >= spikeFloor) {
    alerts.push({
      type: 'pico_volume',
      severity: recent.length >= spikeFloor * 1.5 ? 'alta' : 'media',
      message: `Pico de cobertura: ${recent.length} itens no período (baseline ~${baselineDailyAvg.toFixed(1)}/dia).`,
      count: recent.length,
      items: recent.slice(0, th.topItems),
    })
  }

  // 2) Negative/critical sentiment — the reputational-risk signal.
  const neg = recent.filter(isNegative)
  if (neg.length >= th.negativeMin) {
    alerts.push({
      type: 'sentimento_negativo',
      severity: neg.length >= th.negativeHigh ? 'alta' : 'media',
      message: `${neg.length} ${neg.length === 1 ? 'item' : 'itens'} de tom negativo/crítico no período.`,
      count: neg.length,
      items: neg.slice(0, th.topItems),
    })
  }

  // 3) High-relevance items — worth a look regardless of tone.
  const alta = recent.filter((a) => a.relevancia === 'alta')
  if (alta.length >= 1) {
    alerts.push({
      type: 'alta_relevancia',
      severity: 'info',
      message: `${alta.length} ${alta.length === 1 ? 'item' : 'itens'} de alta relevância no período.`,
      count: alta.length,
      items: alta.slice(0, th.topItems),
    })
  }

  return alerts
}

export function hasAlerts(digests: ClientDigest[]): boolean {
  return digests.some((d) => d.alerts.length > 0)
}

/** Highest severity present, for subject-line urgency. */
export function topSeverity(digests: ClientDigest[]): AlertSeverity | null {
  const order: AlertSeverity[] = ['alta', 'media', 'info']
  for (const s of order) if (digests.some((d) => d.alerts.some((a) => a.severity === s))) return s
  return null
}

export function digestSubject(digests: ClientDigest[], periodLabel: string): string {
  const withAlerts = digests.filter((d) => d.alerts.length > 0)
  const total = withAlerts.reduce((n, d) => n + d.alerts.length, 0)
  const sev = topSeverity(digests)
  const flag = sev === 'alta' ? '🔴 ' : sev === 'media' ? '🟠 ' : ''
  return `${flag}CORTEX · ${total} alerta(s) em ${withAlerts.length} cliente(s) — ${periodLabel}`
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const TYPE_LABEL: Record<AlertType, string> = {
  pico_volume: 'Pico de volume',
  sentimento_negativo: 'Sentimento negativo',
  alta_relevancia: 'Alta relevância',
}

export function renderDigestText(digests: ClientDigest[], periodLabel: string): string {
  const lines: string[] = [`CORTEX — Alertas de inteligência · ${periodLabel}`, '']
  for (const d of digests) {
    if (!d.alerts.length) continue
    lines.push(`## ${d.clientName}`)
    for (const a of d.alerts) {
      lines.push(`- [${TYPE_LABEL[a.type]}] ${a.message}`)
      for (const it of a.items) {
        const data = it.published_at ? new Date(it.published_at).toLocaleDateString('pt-BR') : ''
        lines.push(`    • ${it.veiculo}${data ? ` (${data})` : ''}: ${it.title} — ${it.url}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function renderDigestHtml(digests: ClientDigest[], periodLabel: string): string {
  const sevColor: Record<AlertSeverity, string> = { alta: '#b3372f', media: '#c67d1a', info: '#0c5a50' }
  const blocks: string[] = []
  for (const d of digests) {
    if (!d.alerts.length) continue
    const alertHtml = d.alerts
      .map((a) => {
        const items = a.items
          .map((it) => {
            const data = it.published_at ? new Date(it.published_at).toLocaleDateString('pt-BR') : ''
            return `<li style="margin:2px 0"><a href="${escapeHtml(it.url)}" style="color:#0c5a50">${escapeHtml(it.title)}</a> <span style="color:#888">— ${escapeHtml(it.veiculo)}${data ? ` · ${data}` : ''}</span></li>`
          })
          .join('')
        return `<div style="margin:8px 0"><span style="display:inline-block;font:600 11px/1.4 monospace;color:#fff;background:${sevColor[a.severity]};padding:2px 8px;border-radius:3px">${TYPE_LABEL[a.type]}</span> <span style="color:#333">${escapeHtml(a.message)}</span><ul style="margin:6px 0 0;padding-left:18px;font:14px/1.5 -apple-system,system-ui,sans-serif">${items}</ul></div>`
      })
      .join('')
    blocks.push(`<h2 style="font:700 18px/1.3 -apple-system,system-ui,sans-serif;color:#14201d;margin:22px 0 4px">${escapeHtml(d.clientName)}</h2>${alertHtml}`)
  }
  return `<div style="max-width:640px;margin:0 auto;font:14px/1.6 -apple-system,system-ui,sans-serif;color:#14201d">
<div style="font:600 12px/1.4 monospace;letter-spacing:.1em;text-transform:uppercase;color:#0c5a50">CORTEX · Alertas de inteligência</div>
<div style="color:#888;font-size:13px;margin-bottom:8px">${escapeHtml(periodLabel)}</div>
${blocks.join('')}
</div>`
}
