import { NextResponse } from 'next/server'
import { z } from 'zod'
import { loadPanelThemes } from '@/lib/panel-themes'
import { saoPauloPeriod } from '@/lib/report-automation'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Pública como as demais: expõe título, link e veículo das matérias do cliente.
// Custo: só leitura no banco, nenhum token da Anthropic.
const querySchema = z.object({
  client: z.string().uuid(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
})

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams
  const parsed = querySchema.safeParse({
    client: params.get('client'),
    period: params.get('period') ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: 'Cliente ou período inválido.' }, { status: 400 })
  try {
    const result = await loadPanelThemes(createClient(), parsed.data.client, parsed.data.period ?? saoPauloPeriod())
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Falha ao montar os temas.' }, { status: 500 })
  }
}
