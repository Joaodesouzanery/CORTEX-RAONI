import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/report-drafts'

export const dynamic = 'force-dynamic'

// Pública: expõe só itens de agências, dado oficial. Só leitura, sem token.
export async function GET() {
  const supabase = createClient()
  try {
    const items = await fetchAll<Record<string, unknown>>((from, to) =>
      supabase
        .from('regulatory_agenda_items')
        .select('id, agency, title, item_type, phase, deadline, official_url, client_names, checked_at, source_label')
        .order('deadline', { ascending: true, nullsFirst: false })
        .range(from, to)
    )
    return NextResponse.json({ items })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao ler a agenda.' }, { status: 500 })
  }
}
