import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Only feeds verified to return valid, recent RSS (QA migration 009 deactivated
// the dead ones: Estadão, O Globo, G1, Brasil 247, Canal Energia, Brasil Energia,
// MegaWhat). Thematic Google News feeds live in migration 006.
const DEFAULT_SOURCES = [
  { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', type: 'rss' },
  { name: 'Exame', url: 'https://exame.com/feed/', type: 'rss' },
  { name: 'Poder360', url: 'https://www.poder360.com.br/feed/', type: 'rss' },
  { name: 'Metrópoles', url: 'https://www.metropoles.com/feed', type: 'rss' },
  { name: 'Carta Capital', url: 'https://www.cartacapital.com.br/feed/', type: 'rss' },
  { name: 'Agência Infra', url: 'https://www.agenciainfra.com/blog/feed/', type: 'rss' },
  { name: 'Eixos', url: 'https://eixos.com.br/feed/', type: 'rss' },
  { name: 'Brasil Journal', url: 'https://braziljournal.com/feed/', type: 'rss' },
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
