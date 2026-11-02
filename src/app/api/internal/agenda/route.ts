import { NextResponse } from 'next/server'
import { z } from 'zod'
import { AGENCIES } from '@/lib/sectors'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { safeExternalUrl } from '@/lib/url'

export const dynamic = 'force-dynamic'

// Protegida por CRON_SECRET em src/middleware.ts. Recebe o que o conector leu.
const itemSchema = z.object({
  agency: z.string().refine((agency) => AGENCIES.includes(agency)),
  title: z.string().min(3).max(500),
  item_type: z.string().min(2).max(60),
  phase: z.string().max(120).nullable().optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  official_url: z.string().refine((url) => Boolean(safeExternalUrl(url))),
  client_names: z.array(z.string().max(120)).max(30).optional(),
})
const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(500) })

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Itens inválidos.' }, { status: 400 })
  const now = new Date().toISOString()
  const { data, error } = await createClient()
    .from('regulatory_agenda_items')
    .upsert(
      parsed.data.items.map((item) => ({ ...item, checked_at: now, updated_at: now })),
      { onConflict: 'agency,official_url,title' }
    )
    .select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ saved: data?.length ?? 0 })
}
