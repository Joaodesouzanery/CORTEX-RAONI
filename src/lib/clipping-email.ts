// E-mail do clipping diário no nosso formato (Fase 20, etapa 5): o mesmo texto
// de src/lib/clipping-text.ts, em HTML de e-mail e em texto puro.
//
// Proveniência: título, veículo, data e link — referência, nunca a íntegra
// (sources.access_mode; a íntegra fica com o fornecedor licenciado). Todo
// texto de terceiro é ESCAPADO e todo href passa por safeExternalUrl: React não
// está aqui para sanitizar, e o e-mail vai para fora.

import type { ClippingDay, ClippingParagraph } from '@/lib/clipping-text'
import { escapeHtml } from '@/lib/report-dc-html'
import { safeExternalUrl } from '@/lib/url'

export interface ClippingEmailInput {
  clientDisplayName: string
  brand: string
  day: ClippingDay
  /** Total de matérias do dia etiquetadas para o cliente (denominador do rodapé). */
  totalItems: number
  /** Modo revisão: faixa avisando que é prévia para o dono aprovar. */
  review?: boolean
}

export interface ClippingEmail {
  subject: string
  html: string
  text: string
}

const INK = '#1a1a1a'
const MUTED = '#5b6069'
const RULE = '#e4e2dc'

function linksHtml(paragraph: ClippingParagraph): string {
  const links = paragraph.links.flatMap((link) => {
    const href = safeExternalUrl(link.url)
    return href ? [`<a href="${escapeHtml(href)}" style="color:#0f5563">${escapeHtml(link.outlet)}</a>`] : []
  })
  return links.length ? ` <span style="color:${MUTED};font-size:13px">(${links.join(' · ')})</span>` : ''
}

function paragraphHtml(paragraph: ClippingParagraph): string {
  return `<p style="margin:0 0 14px;line-height:1.55;color:${INK}">${escapeHtml(paragraph.text)}${linksHtml(paragraph)}</p>`
}

function paragraphText(paragraph: ClippingParagraph): string {
  const links = paragraph.links.map((link) => safeExternalUrl(link.url)).filter(Boolean)
  return [paragraph.text, ...links.map((link) => `  ${link}`)].join('\n')
}

export function buildClippingEmail(input: ClippingEmailInput): ClippingEmail {
  const { day } = input
  const shortDate = day.day.split('-').reverse().join('/')
  const subject = `${input.review ? '[Revisão] ' : ''}Clipping ${input.clientDisplayName} — ${shortDate}`
  const shown = day.client.length + day.sector.length
  const footer = `${shown} fato${shown === 1 ? '' : 's'} no e-mail, de ${input.totalItems} matéria${input.totalItems === 1 ? '' : 's'} do dia monitorada${input.totalItems === 1 ? '' : 's'} para ${input.clientDisplayName}. Cada item traz título, veículo e link para a matéria original. Para deixar de receber, responda a este e-mail.`

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f6f5f1">
<div style="max-width:640px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px">
${input.review ? `<div style="background:#fff4d6;border:1px solid #e8c766;padding:10px 12px;margin-bottom:16px;font-size:13px;color:${INK}">Prévia para revisão: só você recebeu. Confira e aprove o envio ao cliente.</div>` : ''}
<div style="border-bottom:2px solid ${INK};padding-bottom:10px;margin-bottom:18px">
<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${MUTED}">${escapeHtml(input.brand)} · Clipping diário</div>
<div style="font-size:22px;font-weight:bold;color:${INK};margin-top:4px">${escapeHtml(input.clientDisplayName)}</div>
<div style="font-size:14px;color:${MUTED};margin-top:2px">${escapeHtml(day.label)}</div>
</div>
${day.client.map(paragraphHtml).join('\n')}
${day.client.length && day.sector.length ? `<hr style="border:0;border-top:1px solid ${RULE};margin:18px 0">` : ''}
${day.sector.map(paragraphHtml).join('\n')}
<p style="margin:24px 0 0;padding-top:12px;border-top:1px solid ${RULE};font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(footer)}</p>
</div></body></html>`

  const text = [
    input.review ? '[Prévia para revisão: só você recebeu.]\n' : null,
    `${input.brand} · Clipping diário`,
    input.clientDisplayName,
    day.label,
    '',
    ...day.client.flatMap((paragraph) => [paragraphText(paragraph), '']),
    ...(day.client.length && day.sector.length ? ['---', ''] : []),
    ...day.sector.flatMap((paragraph) => [paragraphText(paragraph), '']),
    footer,
  ]
    .filter((line) => line !== null)
    .join('\n')

  return { subject, html, text }
}
