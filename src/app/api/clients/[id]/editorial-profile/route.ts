import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { syncDraftEditorialSnapshot } from '@/lib/editorial-directives'

export const dynamic = 'force-dynamic'

const POSTURES = ['consultivo_cauteloso', 'executivo_assertivo', 'somente_descritivo']
const KINDS = ['evidencia', 'contexto', 'ruido', 'estilo']

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createClient()
  const [{ data: profile, error }, { data: topics }, { data: memory }, { data: versions }] = await Promise.all([
    supabase.from('client_editorial_profiles').select('*').eq('client_id', id).maybeSingle(),
    supabase.from('client_report_topic_templates').select('*').eq('client_id', id).eq('active', true).order('position'),
    supabase.from('client_editorial_memory_items').select('*').eq('client_id', id).eq('active', true).order('updated_at', { ascending: false }).limit(100),
    supabase.from('client_editorial_profile_versions').select('id, version, created_at').eq('client_id', id).order('version', { ascending: false }).limit(20),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile, topics: topics || [], memory: memory || [], versions: versions || [] })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.permanent_axes) || !POSTURES.includes(body.default_posture)) {
    return NextResponse.json({ error: 'Perfil editorial inválido.' }, { status: 400 })
  }
  const supabase = createClient()
  const { data: current } = await supabase.from('client_editorial_profiles').select('version').eq('client_id', id).maybeSingle()
  const version = Number(current?.version || 0) + 1
  const snapshot = {
    permanent_axes: body.permanent_axes.map(String).map((item: string) => item.trim()).filter(Boolean).slice(0, 50),
    inclusion_guidelines: String(body.inclusion_guidelines || '').slice(0, 20_000),
    exclusion_guidelines: String(body.exclusion_guidelines || '').slice(0, 20_000),
    style_guidelines: String(body.style_guidelines || '').slice(0, 20_000),
    default_posture: body.default_posture,
    active: body.active !== false,
    topics: Array.isArray(body.topics) ? body.topics : [],
  }
  const { data: profile, error } = await supabase.from('client_editorial_profiles').upsert({
    client_id: id,
    version,
    permanent_axes: snapshot.permanent_axes,
    inclusion_guidelines: snapshot.inclusion_guidelines,
    exclusion_guidelines: snapshot.exclusion_guidelines,
    style_guidelines: snapshot.style_guidelines,
    default_posture: snapshot.default_posture,
    active: snapshot.active,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'client_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.from('client_editorial_profile_versions').insert({ client_id: id, version, snapshot })

  if (Array.isArray(body.topics)) {
    const topicIds = body.topics.map((topic: { id?: string }) => topic.id).filter(Boolean)
    let remove = supabase.from('client_report_topic_templates').delete().eq('client_id', id)
    if (topicIds.length) remove = remove.not('id', 'in', `(${topicIds.join(',')})`)
    const { error: removeError } = await remove
    if (removeError) return NextResponse.json({ error: removeError.message }, { status: 500 })
    for (let index = 0; index < body.topics.length; index += 1) {
      if (body.topics[index].id) {
        await supabase
          .from('client_report_topic_templates')
          .update({ position: 1000 + index })
          .eq('id', body.topics[index].id)
          .eq('client_id', id)
      }
    }
    for (let index = 0; index < body.topics.length; index += 1) {
      const topic = body.topics[index]
      const row = {
        client_id: id,
        position: index + 1,
        title: String(topic.title || '').trim().slice(0, 300),
        rationale: String(topic.rationale || '').slice(0, 3000),
        inclusion_terms: Array.isArray(topic.inclusion_terms) ? topic.inclusion_terms.map(String).filter(Boolean) : [],
        exclusion_terms: Array.isArray(topic.exclusion_terms) ? topic.exclusion_terms.map(String).filter(Boolean) : [],
        required: topic.required !== false,
        active: true,
        updated_at: new Date().toISOString(),
      }
      if (!row.title) continue
      if (topic.id) await supabase.from('client_report_topic_templates').update(row).eq('id', topic.id).eq('client_id', id)
      else await supabase.from('client_report_topic_templates').upsert(row, { onConflict: 'client_id,position' })
    }
  }
  const { data: openDrafts } = await supabase
    .from('monthly_report_drafts')
    .select('*')
    .eq('client_id', id)
    .neq('status', 'approved')
  for (const draft of openDrafts || []) await syncDraftEditorialSnapshot(supabase, draft)
  return NextResponse.json(profile)
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || !KINDS.includes(body.kind)) return NextResponse.json({ error: 'Exemplo editorial inválido.' }, { status: 400 })
  const supabase = createClient()
  let snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : {}
  if (body.article_id) {
    const { data: article } = await supabase.from('articles').select('id, title, publisher, published_at, excerpt').eq('id', body.article_id).maybeSingle()
    if (!article) return NextResponse.json({ error: 'Matéria não encontrada.' }, { status: 404 })
    snapshot = { article }
  }
  const row = {
    client_id: id,
    article_id: body.article_id || null,
    kind: body.kind,
    source: 'curado',
    topic: body.topic ? String(body.topic).slice(0, 300) : null,
    reason: String(body.reason || 'Exemplo mantido explicitamente pelo operador.').slice(0, 3000),
    snapshot,
    active: true,
    updated_at: new Date().toISOString(),
  }
  const query = body.article_id
    ? supabase.from('client_editorial_memory_items').upsert(row, { onConflict: 'client_id,article_id,kind' })
    : supabase.from('client_editorial_memory_items').insert(row)
  const { data, error } = await query.select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
