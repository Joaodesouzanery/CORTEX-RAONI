import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { formatZodError, reportDraftCreateSchema } from '@/lib/validation'
import { monthBounds, refreshDraftEvidence, reportBrand } from '@/lib/report-drafts'
import { SIMINERAL_JULY_2026_TOPICS } from '@/lib/monthly-agenda'
import type { Client, ReportBrand } from '@/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function draftBrand(client: Client, period: string): ReportBrand {
  const snapshot = reportBrand(client)
  if (client.name !== 'SIMINERAL' || period !== '2026-07') return snapshot
  const provisional =
    'Referência provisória de julho/2026: a CRTIVE apoia, auxilia e subsidia; a diretoria do SIMINERAL mantém a coordenação institucional.'
  return {
    ...snapshot,
    guidelines: [snapshot.guidelines, provisional].filter(Boolean).join('\n\n'),
  }
}

export async function GET(req: Request) {
  const supabase = createClient()
  const params = new URL(req.url).searchParams
  let query = supabase
    .from('monthly_report_drafts')
    .select('*, clients(id, name, logo_url)')
    .order('period_month', { ascending: false })
    .order('version', { ascending: false })
    .limit(100)
  if (params.get('client_id')) query = query.eq('client_id', params.get('client_id')!)
  if (params.get('period')) query = query.eq('period_month', monthBounds(params.get('period')!).date)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const supabase = createClient()
  const parsed = reportDraftCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  const {
    client_id,
    period,
    monthly_instructions,
    service_metrics,
    narrative_posture,
    new_version,
  } = parsed.data
  const periodDate = monthBounds(period).date
  const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', client_id).single()
  if (clientError || !client) {
    return NextResponse.json({ error: clientError?.message || 'Cliente não encontrado.' }, { status: 404 })
  }
  const { data: latest } = await supabase
    .from('monthly_report_drafts')
    .select('*')
    .eq('client_id', client_id)
    .eq('period_month', periodDate)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (latest && !new_version) {
    if (latest.status === 'approved') {
      return NextResponse.json(
        { error: 'A versão aprovada é imutável. Use “Nova versão” para continuar.' },
        { status: 409 }
      )
    }
    const { data: updated, error: updateError } = await supabase
      .from('monthly_report_drafts')
      .update({
        monthly_instructions,
        service_metrics,
        narrative_posture,
        updated_at: new Date().toISOString(),
      })
      .eq('id', latest.id)
      .select()
      .single()
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
    const { count: topicCount } = await supabase
      .from('monthly_report_topics')
      .select('id', { count: 'exact', head: true })
      .eq('draft_id', latest.id)
    if (!topicCount && client.name === 'SIMINERAL' && period === '2026-07') {
      await supabase.from('monthly_report_topics').insert(
        SIMINERAL_JULY_2026_TOPICS.map((topic) => ({
          draft_id: latest.id,
          ...topic,
        }))
      )
    }
    if (!topicCount && !(client.name === 'SIMINERAL' && period === '2026-07')) {
      const { data: templates } = await supabase
        .from('client_report_topic_templates')
        .select('position, title, rationale, inclusion_terms, exclusion_terms, required')
        .eq('client_id', client_id)
        .eq('active', true)
        .order('position')
      if (templates?.length) {
        await supabase.from('monthly_report_topics').insert(
          templates.map((topic) => ({ draft_id: latest.id, ...topic }))
        )
      }
    }
    return NextResponse.json({ draft: updated, created: false })
  }

  const [{ data: editorialProfile }, { data: memoryRows }] = await Promise.all([
    supabase.from('client_editorial_profiles').select('*').eq('client_id', client_id).maybeSingle(),
    supabase
      .from('client_editorial_memory_items')
      .select('id, kind, source, topic, reason, snapshot, updated_at')
      .eq('client_id', client_id)
      .eq('active', true)
      .order('updated_at', { ascending: false })
      .limit(40),
  ])
  const memorySnapshot = {
    profile: editorialProfile || null,
    inclusion_examples: (memoryRows || []).filter((item) => item.kind === 'evidencia').slice(0, 6),
    exclusion_examples: (memoryRows || []).filter((item) => item.kind === 'contexto' || item.kind === 'ruido').slice(0, 6),
    captured_at: new Date().toISOString(),
  }
  const { data: draft, error } = await supabase
    .from('monthly_report_drafts')
    .insert({
      client_id,
      period_month: periodDate,
      version: (latest?.version || 0) + 1,
      monthly_instructions,
      service_metrics,
      narrative_posture,
      brand_snapshot: draftBrand(client as Client, period),
      editorial_memory_snapshot: memorySnapshot,
      automation_status: 'pending',
      status: 'preparing',
    })
    .select()
    .single()
  if (error || !draft) return NextResponse.json({ error: error?.message || 'Falha ao preparar relatório.' }, { status: 500 })
  const { error: sectionsError } = await supabase.from('report_sections').insert(
    Array.from({ length: 9 }, (_, index) => ({
      draft_id: draft.id,
      section_key: index + 1,
    }))
  )
  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  let topicsToCreate: Array<{
    position: number
    title: string
    rationale: string
    inclusion_terms: readonly string[] | string[]
    exclusion_terms: readonly string[] | string[]
    required?: boolean
  }> = []
  if (latest) {
    const { data: priorTopics } = await supabase
      .from('monthly_report_topics')
      .select('position, title, rationale, inclusion_terms, exclusion_terms, required')
      .eq('draft_id', latest.id)
      .order('position')
    topicsToCreate = priorTopics || []
  }
  if (!topicsToCreate.length && client.name === 'SIMINERAL' && period === '2026-07') {
    topicsToCreate = [...SIMINERAL_JULY_2026_TOPICS]
  }
  if (!topicsToCreate.length) {
    const { data: templates } = await supabase
      .from('client_report_topic_templates')
      .select('position, title, rationale, inclusion_terms, exclusion_terms, required')
      .eq('client_id', client_id)
      .eq('active', true)
      .order('position')
    topicsToCreate = templates || []
  }
  if (topicsToCreate.length) {
    const { error: topicsError } = await supabase.from('monthly_report_topics').insert(
      topicsToCreate.map((topic) => ({
        draft_id: draft.id,
        position: topic.position,
        title: topic.title,
        rationale: topic.rationale,
        inclusion_terms: [...topic.inclusion_terms],
        exclusion_terms: [...topic.exclusion_terms],
        required: topic.required ?? true,
      }))
    )
    if (topicsError) return NextResponse.json({ error: topicsError.message }, { status: 500 })
  }

  try {
    const refreshed = await refreshDraftEvidence(supabase, draft)
    return NextResponse.json({ ...refreshed, created: true }, { status: 201 })
  } catch (refreshError) {
    const message = refreshError instanceof Error ? refreshError.message : 'Falha ao montar a base.'
    await supabase.from('monthly_report_drafts').update({ status: 'error', error: message }).eq('id', draft.id)
    return NextResponse.json({ error: message, draft }, { status: 500 })
  }
}
