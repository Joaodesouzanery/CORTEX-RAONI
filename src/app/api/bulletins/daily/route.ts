import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadDailyDigest } from '@/lib/daily-digest'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Pública como as demais: título, veículo e link. Só leitura, sem token.
const querySchema = z.object({ client: z.string().uuid(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const parsed = querySchema.safeParse({ client: params.get('client'), day: params.get('day') })
  if (!parsed.success) return NextResponse.json({ error: 'Cliente ou dia inválido.' }, { status: 400 })
  try {
    return NextResponse.json(await loadDailyDigest(createClient(), parsed.data.client, parsed.data.day))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao montar o resumo diário.' }, { status: 500 })
  }
}
