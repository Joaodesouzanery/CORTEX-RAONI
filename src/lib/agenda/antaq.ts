import * as cheerio from 'cheerio'
import type { SupabaseClient } from '@supabase/supabase-js'
import { safeFetch } from '@/lib/safe-fetch'
import { BROWSER_USER_AGENT } from '@/lib/fetcher/constants'

const PAGE_URL =
  'https://www.gov.br/antaq/pt-br/acesso-a-informacao/acoes-e-programas/governanca-regulatoria/agenda-regulatoria-ar/agenda-regulatoria-2025-2028'
/** Boletim de setembro/2026 traz 19 temas ativos com bloco completo; abaixo disso o layout mudou. */
const MIN_THEMES = 15
/** Boletim de setembro/2026 tem 5,6 MB. */
const MAX_PDF_BYTES = 25 * 1024 * 1024
const CLIENT_NAMES = ['ANTAQ', 'DAQ/DNIT']

export type AntaqTheme = { key: string; title: string; phase: string; deadline: string | null }

/** Maior boletim listado: a página vem em ordem, mas o número da edição é o que vale. */
export function latestBulletinUrl(html: string): string | null {
  const $ = cheerio.load(html)
  const links = $('a[href]')
    .map((_, el) => $(el).attr('href') || '')
    .get()
    .filter((href) => /boletim/i.test(href) && /\.pdf$/i.test(href))
  return links[0] ?? null
}

/** Último período citado no bloco: é o prazo oficial da participação social. */
function deadlineFrom(block: string) {
  const match = block.match(/per[ií]odo de \d{2}\/\d{2}\/\d{4} a (\d{2})\/(\d{2})\/(\d{4})/i)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

export function parseAntaqBulletin(text: string): AntaqTheme[] {
  const lines = text.split('\n').map((line) => line.trim())
  const themes = new Map<string, AntaqTheme>()
  for (let index = 0; index < lines.length; index++) {
    const head = lines[index].match(/^(\d\.\d{1,2})\.\s+(.+)$/)
    if (!head) continue
    // O bloco detalhado é o único em que o título é seguido de "O objetivo".
    let cursor = index + 1
    const titleParts = [head[2]]
    while (cursor < lines.length && cursor <= index + 3 && !lines[cursor].startsWith('O objetivo') && !/^\d/.test(lines[cursor])) {
      titleParts.push(lines[cursor])
      cursor++
    }
    if (!lines[cursor]?.startsWith('O objetivo')) continue
    const end = lines.findIndex((line, position) => position > cursor && line.startsWith('Macroetapa:'))
    if (end < 0) continue
    const block = lines.slice(cursor, end + 2).join(' ')
    if (/Status:\s*Exclu[ií]do/i.test(block)) continue
    const phase = lines[end].replace('Macroetapa:', '').trim()
    if (!themes.has(head[1])) {
      themes.set(head[1], { key: head[1], title: `${head[1]} ${titleParts.join(' ')}`, phase, deadline: deadlineFrom(block) })
    }
  }
  return [...themes.values()]
}

export async function syncAntaqAgenda(supabase: SupabaseClient) {
  const page = await safeFetch(PAGE_URL, { headers: { 'User-Agent': BROWSER_USER_AGENT } })
  if (!page.ok) throw new Error(`Página da ANTAQ respondeu HTTP ${page.status}.`)
  const bulletinUrl = latestBulletinUrl(await page.text())
  if (!bulletinUrl) throw new Error('Nenhum boletim encontrado na página da ANTAQ.')

  const { data: current, error: currentError } = await supabase
    .from('regulatory_agenda_items')
    .select('id')
    .eq('agency', 'ANTAQ')
    .eq('official_url', bulletinUrl)
    .not('source_label', 'is', null)
    .limit(1)
  if (currentError) throw new Error(currentError.message)
  if (current?.length) return { bulletinUrl, saved: 0, unchanged: true }

  const pdf = await safeFetch(bulletinUrl, { headers: { 'User-Agent': BROWSER_USER_AGENT } })
  if (!pdf.ok) throw new Error(`Boletim da ANTAQ respondeu HTTP ${pdf.status}.`)
  const buffer = await pdf.arrayBuffer()
  if (buffer.byteLength > MAX_PDF_BYTES) throw new Error('Boletim maior que o limite esperado.')
  // Mesmo shim de src/lib/import/pdf-parser.ts: sem ele o pdf-parse quebra na Vercel.
  const { CanvasFactory } = await import('pdf-parse/worker')
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory })
  const themes = parseAntaqBulletin((await parser.getText()).text)
  // Layout novo não pode apagar nem sujar a agenda: falha alto e mantém a anterior.
  if (themes.length < MIN_THEMES) throw new Error(`Só ${themes.length} temas reconhecidos no boletim; layout pode ter mudado.`)

  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('regulatory_agenda_items')
    .upsert(
      themes.map((theme) => ({
        agency: 'ANTAQ',
        external_key: theme.key,
        title: theme.title,
        item_type: 'Tema da Agenda 2025-2028',
        phase: theme.phase,
        deadline: theme.deadline,
        official_url: bulletinUrl,
        source_label: 'Boletim mensal da ANTAQ',
        client_names: CLIENT_NAMES,
        checked_at: now,
        updated_at: now,
      })),
      { onConflict: 'agency,external_key' }
    )
    .select('id')
  if (error) throw new Error(error.message)
  return { bulletinUrl, saved: data?.length ?? 0, unchanged: false }
}
