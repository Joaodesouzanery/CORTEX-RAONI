import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { startAutomationRun } from '@/lib/report-automation-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(req: Request) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  try {
    const result = await startAutomationRun(createClient(), {
      period: body?.period,
      trigger: body?.trigger,
      includePrevious: body?.include_previous !== false,
      autoSections: body?.auto_sections === true,
    })
    return NextResponse.json(result, { status: result.reused || !result.run_id ? 200 : 201 })
  } catch (startError) {
    const message = startError instanceof Error ? startError.message : 'Falha ao iniciar automação.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
