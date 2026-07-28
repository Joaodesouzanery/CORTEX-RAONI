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
  const { error: insertError } = await supabase.from('client_sources').insert(
    sources.map((source) => ({
      client_id: clientId,
      source_id: source.id,
      priority: source.priority || 50,
      is_thematic: true,
    }))
  )
  if (insertError) throw new Error(insertError.message)
}
