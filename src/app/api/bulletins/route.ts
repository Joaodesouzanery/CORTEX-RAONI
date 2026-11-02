import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadBulletin } from '@/lib/bulletin'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Pública como as demais: expõe título, link e veículo. Só leitura, sem token.
const querySchema = z.object({ client: z.string().uuid() })

export async function GET(req: Request) {
  const parsed = querySchema.safeParse({ client: new URL(req.url).searchParams.get('client') })
  if (!parsed.success) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 400 })
  try {
    return NextResponse.json(await loadBulletin(createClient(), parsed.data.client))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao montar o boletim.' }, { status: 500 })
  }
}
