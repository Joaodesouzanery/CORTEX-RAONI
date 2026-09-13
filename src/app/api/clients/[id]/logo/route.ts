import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Identifica o tipo pelos bytes iniciais, não pelo nome nem pelo `file.type`.
 *
 * O bucket `logos` é PÚBLICO. Antes, `contentType` vinha verbatim do cliente e
 * a extensão saía de `file.name`: dava para subir HTML ou SVG servido como
 * `text/html` num caminho previsível (`${id}.${ext}`) e com `upsert: true`.
 * Isso é hospedagem arbitrária e XSS armazenado na origem do Storage — e, de
 * quebra, anulava a proteção do `remotePatterns` do next.config.js, que
 * restringe o otimizador de imagem justamente a esse host.
 *
 * SVG fica de fora de propósito: é XML, executa script, e não há por que um
 * logo precisar disso aqui.
 */
function sniffImage(bytes: Uint8Array): { ext: string; contentType: string } | null {
  const at = (i: number) => bytes[i]
  if (bytes.length >= 8 && at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) {
    return { ext: 'png', contentType: 'image/png' }
  }
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (bytes.length >= 6 && at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x38) {
    return { ext: 'gif', contentType: 'image/gif' }
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50
  ) {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  return null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })

  const supabase = createClient()
  const formData = await req.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: 'Logo acima de 2 MB.' }, { status: 413 })
  }

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (clientError) return NextResponse.json({ error: clientError.message }, { status: 500 })
  if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  // Confere de novo depois de ler: `file.size` é declarado pelo remetente.
  if (bytes.byteLength > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: 'Logo acima de 2 MB.' }, { status: 413 })
  }
  const sniffed = sniffImage(bytes)
  if (!sniffed) {
    return NextResponse.json(
      { error: 'Formato não suportado. Envie PNG, JPEG, GIF ou WebP.' },
      { status: 415 }
    )
  }

  // Caminho com UUID: não é adivinhável e não sobrescreve o logo anterior —
  // o path antigo era `${id}.${ext}`, previsível e com upsert habilitado.
  const path = `${id}/${crypto.randomUUID()}.${sniffed.ext}`
  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(path, bytes, { contentType: sniffed.contentType, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('clients')
    .update({ logo_url: publicUrl })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ logo_url: publicUrl })
}
