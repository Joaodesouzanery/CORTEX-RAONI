import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { refreshImportBatch } from '@/lib/import/batches'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  try {
    const batch = await refreshImportBatch(supabase, id)
    const [{ data: documents, error }, { data: links, error: linksError }] = await Promise.all([
      supabase
        .from('import_batch_documents')
        .select('*, source_documents(*)')
        .eq('batch_id', id)
        .order('created_at'),
      supabase
        .from('import_batch_clients')
        .select('client_id, clients(id, name)')
        .eq('batch_id', id),
    ])
    if (error || linksError) throw new Error(error?.message || linksError?.message)
    const selectedClients = (links || []).flatMap((link) => {
      const client = Array.isArray(link.clients) ? link.clients[0] : link.clients
      return client ? [client] : []
    })
    return NextResponse.json({
      ...batch,
      client_ids: (links || []).map((link) => link.client_id),
      selected_clients: selectedClients,
      documents: documents || [],
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lote não encontrado.' },
      { status: 404 }
    )
  }
}
