import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMail = vi.fn()
vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail })) }, createTransport: vi.fn(() => ({ sendMail })) }))

describe('envio pelo Gmail (senha de app)', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = 'dono@gmail.com'
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop'
    process.env.ALERTS_EMAIL_FROM = 'Clipping CRT <qualquer@outro.com>'
    delete process.env.RESEND_API_KEY
    sendMail.mockReset()
  })
  afterEach(() => {
    delete process.env.GMAIL_USER
    delete process.env.GMAIL_APP_PASSWORD
    delete process.env.ALERTS_EMAIL_FROM
  })

  it('Gmail tem prioridade, envia como a própria conta e leva cópia oculta', async () => {
    sendMail.mockResolvedValue({ messageId: '<id@gmail>' })
    const { sendEmail, emailProvider, senderAddress } = await import('./email')
    expect(emailProvider()).toBe('gmail')
    expect(senderAddress()).toBe('dono@gmail.com')
    const result = await sendEmail({ subject: 'S', html: '<p>x</p>', text: 'x', to: ['dono@gmail.com'], bcc: ['a@cliente.com'], replyTo: 'dono@gmail.com' })
    expect(result).toEqual({ sent: true, id: '<id@gmail>' })
    expect(sendMail.mock.calls[0][0]).toMatchObject({ from: 'Clipping CRT <dono@gmail.com>', bcc: ['a@cliente.com'] })
  })

  it('senha errada vira mensagem que diz o que fazer', async () => {
    sendMail.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }))
    const { sendEmail } = await import('./email')
    const result = await sendEmail({ subject: 'S', html: 'x', text: 'x', to: ['dono@gmail.com'] })
    expect(result.sent).toBe(false)
    expect(result.error).toContain('senha de app')
  })
})
