// Envio de e-mail — plug-in isolado, dormente até configurar (mesmo padrão da
// IA: põe as variáveis e liga, sem mexer em código).
//
// Dois provedores (decisão do dono em 17/11/2026: Gmail com senha de app):
//   1. Gmail (SMTP smtp.gmail.com:465), com GMAIL_USER + GMAIL_APP_PASSWORD.
//      Grátis, ~500 destinatários/dia em conta pessoal. Tem prioridade.
//   2. Resend (HTTP), com RESEND_API_KEY. Alternativa com domínio próprio.
// ALERTS_EMAIL_TO: destinatários do dono (alertas e revisão do clipping).

type Provider = 'gmail' | 'resend'

export function emailProvider(): Provider | null {
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return 'gmail'
  if (process.env.RESEND_API_KEY) return 'resend'
  return null
}

export function emailEnabled(): boolean {
  return !!emailProvider() && !!process.env.ALERTS_EMAIL_TO
}

export interface SendResult {
  sent: boolean
  skipped?: string // reason when not sent
  id?: string
  error?: string
}

/** Destinatários do dono (alertas e modo revisão do clipping). */
export function ownerRecipients(): string[] {
  return (process.env.ALERTS_EMAIL_TO || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Endereço do remetente, sem o nome ("CORTEX <a@b>" → "a@b"). */
function senderFrom(): string {
  const configured = process.env.ALERTS_EMAIL_FROM?.trim()
  if (emailProvider() === 'gmail') {
    // O Gmail só envia como a própria conta: o nome pode mudar, o endereço não.
    const name = configured?.match(/^([^<]+)</)?.[1]?.trim() || 'Clipping Cortex'
    return `${name} <${process.env.GMAIL_USER}>`
  }
  return configured || 'CORTEX <onboarding@resend.dev>'
}

export function senderAddress(): string {
  const from = senderFrom()
  return from.match(/<([^>]+)>/)?.[1] || from
}

/** Remetente utilizável para enviar ao cliente: Gmail sempre; Resend só com domínio próprio. */
export function senderReadyForClients(): boolean {
  if (emailProvider() === 'gmail') return true
  return !!process.env.ALERTS_EMAIL_FROM?.trim()
}

export async function sendEmail(opts: {
  subject: string
  html: string
  text: string
  /** Sem `to`, vai para ALERTS_EMAIL_TO (comportamento original dos alertas). */
  to?: string[]
  /** Cópia oculta: destinatários do cliente não veem o e-mail uns dos outros (LGPD). */
  bcc?: string[]
  replyTo?: string | null
}): Promise<SendResult> {
  const provider = emailProvider()
  const key = process.env.RESEND_API_KEY
  const to = opts.to ?? ownerRecipients()
  const from = senderFrom()

  if (!provider || to.length === 0) {
    return {
      sent: false,
      skipped: !provider
        ? 'e-mail não configurado (defina GMAIL_USER e GMAIL_APP_PASSWORD, ou RESEND_API_KEY)'
        : opts.to
          ? 'sem destinatário ativo para este envio'
          : 'e-mail não configurado (defina ALERTS_EMAIL_TO)',
    }
  }

  if (provider === 'gmail') {
    try {
      const nodemailer = await import('nodemailer')
      const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      })
      const info = await transport.sendMail({
        from,
        to,
        bcc: opts.bcc?.length ? opts.bcc : undefined,
        replyTo: opts.replyTo || undefined,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      })
      return { sent: true, id: info.messageId }
    } catch (e) {
      // Erro de login vem como EAUTH: quase sempre senha comum no lugar da senha de app.
      const error = e as { code?: string; message?: string }
      return { sent: false, error: error.code === 'EAUTH' ? 'Gmail recusou o login: use uma senha de app (docs/email.md), não a senha da conta.' : error.message || 'falha no Gmail' }
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        ...(opts.bcc?.length ? { bcc: opts.bcc } : {}),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    })
    const data = (await res.json().catch(() => null)) as { id?: string; message?: string } | null
    if (!res.ok) return { sent: false, error: data?.message || `Resend HTTP ${res.status}` }
    return { sent: true, id: data?.id }
  } catch (e) {
    return { sent: false, error: (e as Error).message }
  }
}
