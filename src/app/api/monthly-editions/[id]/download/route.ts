import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const { data: edition, error } = await supabase
    .from('monthly_editions')
    .select('pdf_storage_path')
    .eq('id', id)
    .single()
  if (error || !edition?.pdf_storage_path) {
    return NextResponse.json({ error: error?.message || 'PDF ainda não disponível.' }, { status: 404 })
  }
  const { data, error: signedError } = await supabase.storage
    .from('monthly-clippings')
    .createSignedUrl(edition.pdf_storage_path, 60 * 10)
  if (signedError || !data?.signedUrl) {
    return NextResponse.json({ error: signedError?.message || 'Falha ao assinar download.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
