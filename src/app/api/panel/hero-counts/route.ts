import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Janela do hero de Notícias. O /api/dashboard calcula 9 contadores por cliente
// e estourava statement_timeout aqui; o hero só precisa de dois.
const HERO_DAYS = 30

// Pública e só leitura: contagens por cliente, sem conteúdo de matéria. Sem token.
export async function GET() {
  const supabase = createAdminClient()
  const start = new Date(Date.now() - HERO_DAYS * 86_400_000).toISOString()
  const [{ data: clients, error: clientsError }, { data: counts, error: countsError }] = await Promise.all([
    supabase.from('clients').select('id, name').eq('active', true).order('name'),
    supabase.rpc('news_hero_counts', { p_start: start }),
  ])
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })
  const byClient = new Map(((counts || []) as Array<{ client_id: string; total: number; direct: number }>).map((row) => [row.client_id, row]))
  return NextResponse.json({
    window_days: HERO_DAYS,
    // Falha das contagens degrada visível: clientes aparecem, números não.
    counts_warning: countsError ? `Contagens indisponíveis (${countsError.code}). Aplique a migration 052.` : null,
    clients: (clients || []).map((client) => ({
      id: client.id,
      name: client.name,
      total: countsError ? null : Number(byClient.get(client.id)?.total ?? 0),
      direct: countsError ? null : Number(byClient.get(client.id)?.direct ?? 0),
    })),
  })
}
