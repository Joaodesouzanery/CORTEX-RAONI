import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { importInitSchema, formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('source_documents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = importInitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { filename, sha256 } = parsed.data

  const { data: existing } = await supabase
    .from('source_documents')
    .select('*')
    .eq('sha256', sha256.toLowerCase())
    .maybeSingle()
  if (existing) return NextResponse.json({ duplicate: true, document: existing })

  const safeName = filename
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
  const now = new Date()
  const prefix = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const id = crypto.randomUUID()
  const storagePath = `${prefix}/${id}-${safeName || 'documento.pdf'}`

  const { data: document, error: insertError } = await supabase
    .from('source_documents')
    .insert({
      id,
      filename,
      storage_path: storagePath,
      sha256: sha256.toLowerCase(),
      status: 'enviado',
    })
    .select()
    .single()
  if (insertError?.code === '23505') {
    const { data: duplicate } = await supabase
      .from('source_documents')
      .select('*')
      .eq('sha256', sha256.toLowerCase())
      .single()
    if (duplicate) return NextResponse.json({ duplicate: true, document: duplicate })
  }
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  const { data: signed, error: signError } = await supabase.storage
    .from('source-documents')
    .createSignedUploadUrl(storagePath)
  if (signError || !signed) {
    await supabase
      .from('source_documents')
      .update({ status: 'erro', error: signError?.message || 'Falha ao assinar upload' })
      .eq('id', id)
    return NextResponse.json({ error: signError?.message || 'Falha ao preparar upload' }, { status: 500 })
  }

  return NextResponse.json(
    {
      duplicate: false,
      document,
      upload: { path: storagePath, token: signed.token },
    },
    { status: 201 }
  )
}
