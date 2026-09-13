import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { processNextAutomationJob } from '@/lib/report-automation-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(req.url).origin
  try {
    const result = await processNextAutomationJob(createClient(), {
      origin,
      runId: body?.run_id || null,
      clientId: body?.client_id || null,
      resume: body?.resume === true,
    })
    return NextResponse.json(result)
  } catch (processError) {
    const message = processError instanceof Error ? processError.message : 'Falha na automação editorial.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
