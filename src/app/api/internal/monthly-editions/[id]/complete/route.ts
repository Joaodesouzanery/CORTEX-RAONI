import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { internalAuthorized } from '@/lib/internal-auth'
import { editionCompleteSchema, formatZodError } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!internalAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => null)
  const parsed = editionCompleteSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data, error } = await supabase
    .from('monthly_editions')
    .update({
      status: 'concluido',
      pdf_storage_path: parsed.data.pdf_storage_path,
      summary_markdown: parsed.data.summary_markdown,
      summary_data: parsed.data.summary_data || {},
      generated_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', id)
    .neq('status', 'concluido')
    .select()
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) {
    return NextResponse.json({ error: 'Edição concluída é imutável; crie uma nova versão.' }, { status: 409 })
  }
  return NextResponse.json(data)
}
