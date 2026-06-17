import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEFAULT_SOURCES = [
  { name: 'Folha de S.Paulo', url: 'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml', type: 'rss' },
  { name: 'Estadão', url: 'https://www.estadao.com.br/rss/ultimas.xml', type: 'rss' },
  { name: 'Agência Estado / Broadcast', url: 'https://www.estadao.com.br/rss/economia.xml', type: 'rss' },
  { name: 'Exame', url: 'https://exame.com/feed/', type: 'rss' },
  { name: 'Poder360', url: 'https://poder360.com.br/feed/', type: 'rss' },
  { name: 'O Globo', url: 'https://oglobo.globo.com/rss.xml', type: 'rss' },
  { name: 'G1', url: 'https://g1.globo.com/rss/g1/index.xml', type: 'rss' },
  { name: 'Metrópoles', url: 'https://www.metropoles.com/feed', type: 'rss' },
  { name: 'Brasil 247', url: 'https://www.brasil247.com/rss', type: 'rss' },
  { name: 'Carta Capital', url: 'https://www.cartacapital.com.br/feed/', type: 'rss' },
  { name: 'MegaWhat', url: 'https://megawhat.energy/feed/', type: 'rss' },
  { name: 'Canal Energia', url: 'https://www.canalenergia.com.br/feed', type: 'rss' },
  { name: 'Agência Infra', url: 'https://www.agenciainfra.com/blog/feed/', type: 'rss' },
  { name: 'Eixos', url: 'https://eixos.com.br/feed/', type: 'rss' },
  { name: 'Brasil Journal', url: 'https://braziljournal.com/feed/', type: 'rss' },
  { name: 'Brasil Energia', url: 'https://brasil-energia.com.br/feed/', type: 'rss' },
]

export async function POST() {
  const supabase = createClient()

  // Upsert by name so re-running the seed updates corrected URLs
  const { data, error } = await supabase
    .from('sources')
    .upsert(DEFAULT_SOURCES, { onConflict: 'name', ignoreDuplicates: false })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: `Fontes padrão sincronizadas.`, sources: data })
}
