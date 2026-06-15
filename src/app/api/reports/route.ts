import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateReport } from '@/lib/ai/claude'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from('reports').select('id, prompt, article_ids, created_at').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { prompt, article_ids } = await req.json()

  const { data: articles } = await supabase
    .from('articles')
    .select('*, sources(name)')
    .in('id', article_ids)

  if (!articles?.length) return NextResponse.json({ error: 'No articles found' }, { status: 400 })

  const content = await generateReport(articles as any, prompt)

  const { data, error } = await supabase
    .from('reports')
    .insert({ prompt, article_ids, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
