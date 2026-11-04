import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { loadClippingDay } from '@/lib/clipping'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const querySchema = z.object({
  client_id: z.string().uuid('Cliente inválido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a data YYYY-MM-DD'),
})

// Pública e só leitura (mesma exposição de Notícias): título, link e veículo das
// matérias do dia por cliente, sem texto integral. Não gasta token.
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = querySchema.safeParse(params)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Parâmetros inválidos.' }, { status: 400 })
  try {
    return NextResponse.json(await loadClippingDay(createAdminClient(), parsed.data.client_id, parsed.data.date))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao montar o clipping.' }, { status: 500 })
  }
}
