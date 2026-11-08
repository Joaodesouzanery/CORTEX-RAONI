import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/server'
import { buildClippingEmail } from '@/lib/clipping-email'
import { clippingBrand, defaultClippingDay, loadClippingDay } from '@/lib/clipping-email-data'
import { ownerRecipients, sendEmail, senderAddress } from '@/lib/email'
import { clippingEmailSendSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Reserva 'enviando' mais velha que isso = disparo que morreu no meio (a
// função tem 60s). Pode ser retomada; antes disso, outro disparo está ativo.
const STALE_SEND_MS = 10 * 60 * 1000

type Outcome = {
  client_id: string
  client: string
  status: 'enviado' | 'ja_enviado' | 'sem_materia' | 'sem_destinatario' | 'nao_configurado' | 'erro'
  detail?: string
  recipients?: number
  items?: number
}

// Protegida pelo middleware (Bearer CRON_SECRET em /api/internal/*). Chamada
// pelo .github/workflows/daily-clipping-email.yml.
//   mode=review (padrão): o e-mail de cada cliente vai só para o dono
//     (ALERTS_EMAIL_TO), com a faixa "prévia para revisão".
//   mode=send: vai para os destinatários ativos de client_email_recipients,
//     em cópia oculta (um não vê o e-mail do outro).
// Idempotente: clipping_email_sends tem chave (cliente, dia, modo); o segundo
// disparo do mesmo dia é no-op registrado. Envio que falhou pode ser refeito.
// Custo: Resend (faixa grátis de 3.000/mês); nenhuma chamada à Anthropic.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const parsed = clippingEmailSendSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Parâmetros inválidos.' }, { status: 400 })
  const { mode, client_ids: clientIds } = parsed.data
  const day = parsed.data.date || defaultClippingDay()

  // Falta de configuração parqueia VISÍVEL, antes de tocar em qualquer cliente.
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ day, mode, status: 'nao_configurado', detail: 'Defina RESEND_API_KEY e ALERTS_EMAIL_FROM (docs/email.md).' }, { status: 503 })
  }
  // O remetente padrão do Resend (onboarding@resend.dev) só entrega para a
  // própria conta: e-mail ao cliente exige domínio verificado.
  if (mode === 'send' && !process.env.ALERTS_EMAIL_FROM?.trim()) {
    return NextResponse.json({ day, mode, status: 'nao_configurado', detail: 'Defina ALERTS_EMAIL_FROM com um domínio verificado no Resend antes de enviar ao cliente.' }, { status: 503 })
  }
  if (mode === 'review' && !ownerRecipients().length) {
    return NextResponse.json({ day, mode, status: 'nao_configurado', detail: 'Defina ALERTS_EMAIL_TO para receber a revisão.' }, { status: 503 })
  }

  const supabase = createAdminClient()
  let clientsQuery = supabase.from('clients').select('id, name').eq('active', true).order('name')
  if (clientIds?.length) clientsQuery = clientsQuery.in('id', clientIds)
  const { data: clients, error: clientsError } = await clientsQuery
  if (clientsError) return NextResponse.json({ error: clientsError.message }, { status: 500 })

  const outcomes: Outcome[] = []
  for (const client of clients || []) {
    try {
      outcomes.push(await sendForClient(supabase, client, day, mode))
    } catch (error) {
      outcomes.push({ client_id: client.id, client: client.name, status: 'erro', detail: (error as Error).message })
    }
  }
  const failed = outcomes.filter((outcome) => outcome.status === 'erro').length
  return NextResponse.json({ day, mode, outcomes, failed }, { status: failed ? 207 : 200 })
}

async function sendForClient(
  supabase: SupabaseClient,
  client: { id: string; name: string },
  day: string,
  mode: 'review' | 'send'
): Promise<Outcome> {
  const base = { client_id: client.id, client: client.name }
  const data = await loadClippingDay(supabase, client.id, day, mode === 'send' ? 'omit' : 'mark')
  if (!data.day) return { ...base, status: 'sem_materia', items: data.total }

  let recipients = ownerRecipients()
  if (mode === 'send') {
    const { data: rows, error } = await supabase
      .from('client_email_recipients')
      .select('email')
      .eq('client_id', client.id)
      .eq('active', true)
    if (error) throw new Error(`Destinatários indisponíveis (${error.code}). Aplique a migration 058.`)
    recipients = (rows || []).map((row) => row.email)
    if (!recipients.length) return { ...base, status: 'sem_destinatario', items: data.total }
  }

  // Marca antes da reserva: se a consulta falhar, nada fica preso em 'enviando'.
  const brand = await clippingBrand(supabase, client.id)

  // Reserva o envio ANTES de mandar: dois disparos simultâneos não mandam dois.
  const { data: reserved, error: reserveError } = await supabase
    .from('clipping_email_sends')
    .insert({ client_id: client.id, day, mode, status: 'enviando', recipients_count: recipients.length, items_count: data.total })
    .select('id')
    .maybeSingle()
  let sendId = reserved?.id as number | undefined
  if (reserveError) {
    // 23505 = violação de unicidade: já existe registro deste cliente/dia/modo.
    if (reserveError.code !== '23505') throw new Error(`Registro de envio indisponível (${reserveError.code}). Aplique a migration 058.`)
    const { data: existing, error: existingError } = await supabase
      .from('clipping_email_sends')
      .select('id, status, updated_at')
      .eq('client_id', client.id)
      .eq('day', day)
      .eq('mode', mode)
      .single()
    if (existingError) throw new Error(existingError.message)
    const stale = existing.status === 'enviando' && Date.now() - new Date(existing.updated_at).getTime() > STALE_SEND_MS
    if (existing.status === 'enviado' || (existing.status === 'enviando' && !stale)) {
      return { ...base, status: 'ja_enviado', detail: existing.status }
    }
    // Envio anterior falhou ou morreu no meio: retoma, mas só se ninguém
    // retomou primeiro (o filtro por status + updated_at é a trava).
    const { data: retaken, error: retakeError } = await supabase
      .from('clipping_email_sends')
      .update({ status: 'enviando', error: null, recipients_count: recipients.length, items_count: data.total, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .eq('status', existing.status)
      .eq('updated_at', existing.updated_at)
      .select('id')
      .maybeSingle()
    if (retakeError) throw new Error(retakeError.message)
    if (!retaken) return { ...base, status: 'ja_enviado', detail: 'retomado por outro disparo' }
    sendId = retaken.id as number
  }
  if (!sendId) throw new Error('Registro de envio não confirmado.')

  let result: Awaited<ReturnType<typeof sendEmail>>
  try {
    const email = buildClippingEmail({ clientDisplayName: brand.displayName, brand: brand.brand, day: data.day, totalItems: data.total, review: mode === 'review' })
    result =
      mode === 'review'
        ? await sendEmail({ ...email, to: recipients })
        : await sendEmail({ ...email, to: [senderAddress()], bcc: recipients, replyTo: ownerRecipients()[0] || null })
  } catch (error) {
    // Nunca deixar a reserva em 'enviando' por exceção: vira erro retomável.
    result = { sent: false, error: (error as Error).message }
  }

  const { data: updated, error: updateError } = await supabase
    .from('clipping_email_sends')
    .update({
      status: result.sent ? 'enviado' : 'erro',
      provider_id: result.id ?? null,
      error: result.sent ? null : result.error || result.skipped || 'falha sem detalhe',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sendId)
    .select('id')
    .maybeSingle()
  if (updateError || !updated) {
    // O e-mail pode ter saído; o registro não. Visível, para não reenviar às cegas.
    return { ...base, status: 'erro', detail: `E-mail ${result.sent ? 'enviado' : 'não enviado'}, mas o registro falhou: ${updateError?.message || 'linha não atualizada'}` }
  }
  if (!result.sent) return { ...base, status: 'erro', detail: result.error || result.skipped, recipients: recipients.length, items: data.total }
  return { ...base, status: 'enviado', recipients: recipients.length, items: data.total }
}
