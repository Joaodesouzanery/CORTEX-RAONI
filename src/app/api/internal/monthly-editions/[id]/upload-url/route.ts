import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'

export const dynamic = 'force-dynamic'

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const supabase = createClient()
  const { data: edition, error } = await supabase
    .from('monthly_editions')
    .select('period_month, version, status, clients(name)')
    .eq('id', id)
    .single()
  if (error || !edition)
    return NextResponse.json({ error: error?.message || 'Edição não encontrada.' }, { status: 404 })
  if (edition.status === 'concluido') {
    return NextResponse.json({ error: 'Edição concluída é imutável; crie uma nova versão.' }, { status: 409 })
  }
  const client = Array.isArray(edition.clients) ? edition.clients[0] : edition.clients
  const period = String(edition.period_month).slice(0, 7)
  const path = `${slug(client?.name || 'cliente')}/${period}/v${edition.version}.pdf`
  const { data, error: signError } = await supabase.storage
    .from('monthly-clippings')
    .createSignedUploadUrl(path, { upsert: true })
  if (signError || !data) {
    return NextResponse.json({ error: signError?.message || 'Falha ao assinar upload.' }, { status: 500 })
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token })
}
