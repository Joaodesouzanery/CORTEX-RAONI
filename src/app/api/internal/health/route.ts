import { NextResponse } from 'next/server'
import { runHealthCheck } from '@/lib/health-check'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Protegida por CRON_SECRET em src/middleware.ts. Testa as telas e grava
// alertas que o Painel exibe. Sem custo de token.
export async function POST(req: Request) {
  const appUrl = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, '')
  try {
    const result = await runHealthCheck(createClient(), appUrl)
    return NextResponse.json(result, { status: result.ok ? 200 : 503 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Falha na checagem.' }, { status: 500 })
  }
}
