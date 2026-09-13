import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftSectionEditSchema, reportDraftSectionSchema } from '@/lib/validation'
import { SectionGenerationError, generateDraftSection } from '@/lib/report-section-runner'
import { lintEditorialDirectives } from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; section: string }> }
) {
  const { id, section: rawSection } = await params
  const section = Number(rawSection)
  if (!Number.isInteger(section) || section < 1 || section > 9) {
    return NextResponse.json({ error: 'Seção inválida.' }, { status: 400 })
  }
  const parsed = reportDraftSectionSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  try {
    const result = await generateDraftSection(supabase, id, section, parsed.data.instructions)
    return NextResponse.json(result)
  } catch (generationError) {
    const status = generationError instanceof SectionGenerationError ? generationError.status : 500
    const message = generationError instanceof Error ? generationError.message : 'Falha ao gerar seção.'
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; section: string }> }
) {
  const { id, section: rawSection } = await params
  const section = Number(rawSection)
  const parsed = reportDraftSectionEditSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const supabase = createClient()
  const { data: draft } = await supabase.from('monthly_report_drafts').select('status, applied_editorial_snapshot').eq('id', id).single()
  if (!draft) return NextResponse.json({ error: 'Preparação não encontrada.' }, { status: 404 })
  if (draft.status === 'approved') {
    return NextResponse.json({ error: 'A versão aprovada é imutável.' }, { status: 409 })
  }
  const directiveBlocks = lintEditorialDirectives(
    parsed.data.content,
    draft.applied_editorial_snapshot || null
  ).filter((check) => check.status === 'blocked')
  if (directiveBlocks.length) {
    return NextResponse.json(
      { error: 'O texto viola diretivas editoriais do cliente.', checks: directiveBlocks },
      { status: 409 }
    )
  }
  const now = new Date().toISOString()
  const { data: current } = await supabase
    .from('report_sections')
    .select('version')
    .eq('draft_id', id)
    .eq('section_key', section)
    .single()
  const { data, error } = await supabase
    .from('report_sections')
    .update({
      content: parsed.data.content,
      status: 'edited',
      version: (current?.version || 0) + 1,
      updated_at: now,
    })
    .eq('draft_id', id)
    .eq('section_key', section)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('report_section_revisions').insert({
    draft_id: id,
    section_key: section,
    version: data.version,
    origin: 'humano',
    content: data.content,
  })
  await supabase.from('monthly_report_drafts').update({ status: 'review', updated_at: now }).eq('id', id)
  return NextResponse.json({ section: data })
}
