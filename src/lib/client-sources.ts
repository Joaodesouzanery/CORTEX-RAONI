import type { SupabaseClient } from '@supabase/supabase-js'

export async function syncClientThematicSources(
  supabase: SupabaseClient,
  clientId: string,
  feedNames: string[] | null | undefined
): Promise<void> {
  const names = Array.from(new Set((feedNames || []).filter(Boolean)))
  const { error: deleteError } = await supabase
    .from('client_sources')
    .delete()
    .eq('client_id', clientId)
    .eq('is_thematic', true)
  if (deleteError) throw new Error(deleteError.message)
  if (!names.length) return
  const { data: sources, error: sourcesError } = await supabase.from('sources').select('id, priority').in('name', names)
  if (sourcesError) throw new Error(sourcesError.message)
  if (!sources?.length) return
  // upsert, não insert: o delete acima só remove `is_thematic = true`, então
  // um vínculo NÃO-temático pré-existente para o mesmo par (migration 034 B5
  // cria vários) sobrevive e colide com a PK (client_id, source_id). Com
  // `.insert()` isso lançava, o PUT de cliente virava 500 e — pior — no POST o
  // handler apaga o cliente recém-criado ao tentar compensar.
  // Semanticamente correto: `feed_names` é a fonte de verdade da vinculação
  // temática, então um vínculo existente deve ser PROMOVIDO, não explodir.
  const { error: upsertError } = await supabase.from('client_sources').upsert(
    sources.map((source) => ({
      client_id: clientId,
      source_id: source.id,
      priority: source.priority || 50,
      is_thematic: true,
    })),
    { onConflict: 'client_id,source_id' }
  )
  if (upsertError) throw new Error(upsertError.message)
}
