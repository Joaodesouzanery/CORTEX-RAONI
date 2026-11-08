import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { buildClippingEmail } from '@/lib/clipping-email'
import { clippingBrand, defaultClippingDay, loadClippingDay } from '@/lib/clipping-email-data'
import { clippingEmailPreviewSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

// Prévia do e-mail de clipping de um cliente num dia. NADA é enviado.
// Rota pública como a tela de Clipping (interface sem login, decisão de
// produto): expõe o mesmo que /clipping já mostra — título, veículo, link e
// tom das matérias do dia. Não lê destinatários e não gasta token.
export async function GET(req: Request) {
  const params = Object.fromEntries(new URL(req.url).searchParams)
  const parsed = clippingEmailPreviewSchema.safeParse(params)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Parâmetros inválidos.' }, { status: 400 })
  const day = parsed.data.date || defaultClippingDay()
  const supabase = createAdminClient()
  try {
    const [brand, data] = await Promise.all([
      clippingBrand(supabase, parsed.data.client_id),
      loadClippingDay(supabase, parsed.data.client_id, day),
    ])
    if (!data.day) {
      return NextResponse.json({ day, total: data.total, email: null, reason: 'Nenhuma matéria com link no dia para este cliente.' })
    }
    const email = buildClippingEmail({ clientDisplayName: brand.displayName, brand: brand.brand, day: data.day, totalItems: data.total })
    if (parsed.data.format === 'text') {
      return new NextResponse(email.text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }
    return new NextResponse(email.html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
