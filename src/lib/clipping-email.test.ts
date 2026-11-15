import { describe, expect, it } from 'vitest'
import { buildClippingEmail } from './clipping-email'
import type { ClippingDay } from './clipping-text'

const day: ClippingDay = {
  day: '2026-10-22',
  label: 'Quinta-feira, 22/10/2026',
  client: [
    {
      outlets: ['Veículo <script>'],
      title: 'ONS <img src=x onerror=alert(1)>',
      url: 'javascript:alert(1)',
      links: [
        { outlet: 'Veículo <script>', url: 'javascript:alert(1)' },
        { outlet: 'CNN Brasil', url: 'https://www.cnnbrasil.com.br/economia/ons/' },
      ],
      tone: 'neutro',
      tone_reviewed: true,
      summary: null,
      text: 'Veículo <script> publicou “ONS <img src=x onerror=alert(1)>”. A menção foi técnica.',
    },
  ],
  sector: [],
}

describe('e-mail de clipping', () => {
  const email = buildClippingEmail({ clientDisplayName: 'ONS', brand: 'CRT', day, totalItems: 12 })

  it('escapa texto de terceiro e descarta href perigoso', () => {
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.html).not.toContain('javascript:')
    expect(email.html).toContain('href="https://www.cnnbrasil.com.br/economia/ons/"')
    expect(email.text).not.toContain('javascript:')
  })

  it('assunto e rodapé com denominador e descadastro', () => {
    expect(email.subject).toBe('Clipping ONS — 22/10/2026')
    expect(email.text).toContain('1 fato no e-mail, de 12 matérias do dia monitoradas para ONS')
    expect(email.text).toContain('responda a este e-mail')
  })

  it('modo revisão leva a faixa e o prefixo no assunto', () => {
    const review = buildClippingEmail({ clientDisplayName: 'ONS', brand: 'CRT', day, totalItems: 12, review: true })
    expect(review.subject.startsWith('[Revisão] ')).toBe(true)
    expect(review.html).toContain('Prévia para revisão')
  })
})
