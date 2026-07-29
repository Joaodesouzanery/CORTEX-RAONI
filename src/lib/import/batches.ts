import type { SupabaseClient } from '@supabase/supabase-js'

export async function refreshImportBatch(supabase: SupabaseClient, batchId: string) {
  const { data: rows, error } = await supabase
    .from('import_batch_documents')
    .select('status, article_count')
    .eq('batch_id', batchId)
  if (error) throw new Error(error.message)

  const documents = rows || []
  const completed = documents.filter((row) => row.status === 'complete').length
  const review = documents.filter((row) => row.status === 'review').length
  const failed = documents.filter((row) => row.status === 'error').length
  const terminal = completed + review + failed
  const { data: batch } = await supabase
    .from('import_batches')
    .select('total_files, started_at')
    .eq('id', batchId)
    .single()
  const expected = Math.max(batch?.total_files || 0, documents.length)
  const done = expected > 0 && terminal >= expected
  const status = done
    ? failed === expected
      ? 'error'
      : failed || review
        ? 'partial'
        : 'complete'
    : documents.length
      ? 'processing'
      : 'pending'

  const { data: updated, error: updateError } = await supabase
    .from('import_batches')
    .update({
      status,
      completed_files: completed,
      review_files: review,
      failed_files: failed,
      article_count: documents.reduce((sum, row) => sum + (row.article_count || 0), 0),
      started_at: documents.length ? batch?.started_at || new Date().toISOString() : null,
      completed_at: done ? new Date().toISOString() : null,
    })
    .eq('id', batchId)
    .select('*, clients(id, name)')
    .single()
  if (updateError) throw new Error(updateError.message)
  return updated
}

export function periodMonth(period: string): string {
  return `${period}-01`
}
