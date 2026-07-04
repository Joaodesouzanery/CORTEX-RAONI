import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Only feeds verified to return valid, recent RSS. QA deactivated the dead ones
// (Folha de S.Paulo, Brasil Energia, MegaWhat — HTTP 200 but ~0 items; see
// migration 014). Thematic Google News feeds live in migration 006.
const DEFAULT_SOURCES = [
  { name: 'Exame', url: 'https://exame.com/feed/', type: 'rss' },
  { name: 'Poder360', url: 'https://www.poder360.com.br/feed/', type: 'rss' },
  { name: 'Metrópoles', url: 'https://www.metropoles.com/feed', type: 'rss' },
  { name: 'Carta Capital', url: 'https://www.cartacapital.com.br/feed/', type: 'rss' },
  { name: 'Agência Infra', url: 'https://www.agenciainfra.com/blog/feed/', type: 'rss' },
  { name: 'Eixos', url: 'https://eixos.com.br/feed/', type: 'rss' },
  { name: 'Brasil Journal', url: 'https://braziljournal.com/feed/', type: 'rss' },
  // Direct sector feeds (full text + images) added in QA to cut Google News
  // dependence — see migration 015.
  { name: 'Diário do Transporte', url: 'https://diariodotransporte.com.br/feed/', type: 'rss' },
  { name: 'Mineração Brasil', url: 'https://mineracaobrasil.com/feed/', type: 'rss' },
  { name: 'TI Inside', url: 'https://tiinside.com.br/feed/', type: 'rss' },
  { name: 'Startups', url: 'https://startups.com.br/feed/', type: 'rss' },
  { name: 'Convergência Digital', url: 'https://www.convergenciadigital.com.br/feed/', type: 'rss' },
  // Imprensa especializada de energia / negócios (migration 017).
  { name: 'Cenário Energia', url: 'https://cenarioenergia.com.br/feed/', type: 'rss' },
  { name: 'MegaWhat', url: 'https://megawhat.energy/feed/', type: 'rss' },
  { name: 'InfoMoney', url: 'https://www.infomoney.com.br/feed/', type: 'rss' },
  { name: 'NeoFeed', url: 'https://neofeed.com.br/feed/', type: 'rss' },
  // Institucionais / reguladores via Google News (migration 017).
  { name: 'Institucional — MME', url: 'https://news.google.com/rss/search?q=site:gov.br/mme&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — ANEEL', url: 'https://news.google.com/rss/search?q=ANEEL%20setor%20el%C3%A9trico&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — EPE', url: 'https://news.google.com/rss/search?q=site:epe.gov.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — ONS', url: 'https://news.google.com/rss/search?q=site:ons.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — CCEE', url: 'https://news.google.com/rss/search?q=site:ccee.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — ANM', url: 'https://news.google.com/rss/search?q=%22Ag%C3%AAncia%20Nacional%20de%20Minera%C3%A7%C3%A3o%22&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Institucional — Antaq', url: 'https://news.google.com/rss/search?q=Antaq%20hidrovia%20OR%20porto&hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
  { name: 'Google News — Brasil (manchetes)', url: 'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419', type: 'rss' },
]

export async function POST() {
  const supabase = createClient()

  // Upsert by url (the UNIQUE column) so re-running the seed is idempotent.
  const { data, error } = await supabase
    .from('sources')
    .upsert(DEFAULT_SOURCES, { onConflict: 'url', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `Fontes padrão sincronizadas.`, sources: data })
}
