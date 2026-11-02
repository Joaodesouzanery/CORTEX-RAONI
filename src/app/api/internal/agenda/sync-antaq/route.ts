import { NextResponse } from 'next/server'
import { syncAntaqAgenda } from '@/lib/agenda/antaq'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Protegida por CRON_SECRET em src/middleware.ts. Sem custo de token.
export async function POST() {
  try {
    return NextResponse.json(await syncAntaqAgenda(createClient()))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao sincronizar a agenda.' }, { status: 502 })
  }
}
