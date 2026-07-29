import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { refreshImportBatch } from '@/lib/import/batches'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  try {
    const batch = await refreshImportBatch(supabase, id)
    const { data: documents, error } = await supabase
      .from('import_batch_documents')
      .select('*, source_documents(*)')
      .eq('batch_id', id)
      .order('created_at')
    if (error) throw new Error(error.message)
    return NextResponse.json({ ...batch, documents: documents || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lote não encontrado.' },
      { status: 404 }
    )
  }
}

