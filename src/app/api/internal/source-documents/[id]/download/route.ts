import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = createClient()
  const { data: document, error } = await supabase
    .from('source_documents')
    .select('storage_path')
    .eq('id', id)
    .single()
  if (error || !document) {
    return NextResponse.json({ error: error?.message || 'Documento não encontrado.' }, { status: 404 })
  }
  const { data, error: signedError } = await supabase.storage
    .from('source-documents')
    .createSignedUrl(document.storage_path, 60 * 10)
  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: signedError?.message || 'Falha ao assinar documento.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
