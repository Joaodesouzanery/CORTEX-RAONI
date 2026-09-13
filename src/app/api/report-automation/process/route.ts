import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { processNextAutomationJob } from '@/lib/report-automation-worker'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Um tick da máquina de estados, dirigido pelo navegador.
 *
 * O Painel chama em laço até receber { idle: true }, do mesmo jeito que o
 * "Buscar Notícias" já faz com /api/fetch-runs/[id]/process. `client_id`
 * escopa o claim para o botão de um card não drenar a fila de outro cliente.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const origin = process.env.APP_URL?.replace(/\/$/, '') || new URL(req.url).origin
  try {
    const result = await processNextAutomationJob(createClient(), {
      origin,
      runId: body?.run_id || null,
      clientId: body?.client_id || null,
      // O Painel manda resume no primeiro tick, para devolver à fila o job que
      // ficou parqueado esperando a decisão humana que acabou de ser tomada.
      resume: body?.resume === true,
    })
    return NextResponse.json(result)
  } catch (processError) {
    const message = processError instanceof Error ? processError.message : 'Falha na automação editorial.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
