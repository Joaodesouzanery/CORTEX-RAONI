import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { draftExceptions } from '@/lib/report-automation'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const rows = await draftExceptions(createClient(), id)
    return NextResponse.json({
      total: rows.length,
      items: rows.map(({ item, priority }) => ({ ...item, exception_priority: priority })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao carregar a revisão.' }, { status: 500 })
  }
}
