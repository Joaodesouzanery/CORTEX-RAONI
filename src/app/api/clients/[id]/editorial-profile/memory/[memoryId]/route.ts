import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; memoryId: string }> }) {
  const { id, memoryId } = await params
  const { error } = await createClient()
    .from('client_editorial_memory_items')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', memoryId)
    .eq('client_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ removed: true })
}
