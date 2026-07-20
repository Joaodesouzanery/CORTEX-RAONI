// Email delivery — an isolated plug-in, dormant until configured (same pattern
// as the AI: set the keys and it turns on, no other code changes). Uses the
// Resend HTTP API via fetch, so there is NO new npm dependency.
//
// Env to enable: RESEND_API_KEY, ALERTS_EMAIL_TO (comma-separated), and
// optionally ALERTS_EMAIL_FROM (defaults to Resend's onboarding sender).

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.ALERTS_EMAIL_TO
}

export interface SendResult {
  sent: boolean
  skipped?: string // reason when not sent
  id?: string
  error?: string
}

export async function sendEmail(opts: {
  subject: string
  html: string
  text: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const to = (process.env.ALERTS_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const from = process.env.ALERTS_EMAIL_FROM?.trim() || 'CORTEX <onboarding@resend.dev>'

  if (!key || to.length === 0) {
    return { sent: false, skipped: 'e-mail não configurado (defina RESEND_API_KEY e ALERTS_EMAIL_TO)' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: opts.subject, html: opts.html, text: opts.text }),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!res.ok) return { sent: false, error: data?.message || `Resend HTTP ${res.status}` }
    return { sent: true, id: data?.id }
  } catch (e) {
    return { sent: false, error: (e as Error).message }
  }
}
