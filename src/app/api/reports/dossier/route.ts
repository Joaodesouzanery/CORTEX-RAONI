import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type ReportClient, type ReportMetadata } from '@/lib/ai/claude'
import { reportCreateSchema, formatZodError } from '@/lib/validation'
import type { Article } from '@/types'

export const dynamic = 'force-dynamic'

const MAX_CHARS_PER_ARTICLE = 4000

function cleanText(html: string | null | undefined): string {
  if (!html) return ''
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > MAX_CHARS_PER_ARTICLE ? text.slice(0, MAX_CHARS_PER_ARTICLE) + '…' : text
}

// Builds a self-contained Markdown briefing (master prompt + inputs + full-text
// articles) to paste into Claude Code. No AI call here.
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = reportCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { prompt, article_ids, metadata, client_id } = parsed.data

  const { data: articles } = await supabase
    .from('articles')
    .select('*, sources(name)')
    .in('id', article_ids)
  if (!articles?.length) return NextResponse.json({ error: 'No articles found' }, { status: 400 })

  let client: ReportClient | null = null
  if (client_id) {
    const { data } = await supabase
      .from('clients')
      .select('name, context, report_prompt, sector, contratante')
      .eq('id', client_id)
      .single()
    client = (data as ReportClient) || null
  }

  const m = metadata as ReportMetadata | undefined
  const systemPrompt = buildSystemPrompt(m, client)

  const inputs = [
    'INPUT DO MÊS:',
    `Mês de referência: ${m?.mes || '[preencher]'}`,
    `Reuniões presenciais: ${m?.reunioes_presenciais ?? 0}`,
    `Reuniões virtuais: ${m?.reunioes_virtuais ?? 0}`,
    `Orientações estratégicas: ${m?.orientacoes ?? 0}`,
    `Ações de relacionamento com a imprensa: ${m?.acoes_imprensa ?? 0}`,
  ].join('\n')

  const contextBlock = [
    client?.context ? `CONTEXTO DO CLIENTE (${client.name}):\n${client.context}` : '',
    prompt ? `CONTEXTO ADICIONAL DO CONSULTOR:\n${prompt}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const materias = (articles as Article[])
    .map((a, i) => {
      const veiculo = a.publisher || a.sources?.name || 'Desconhecida'
      const data = a.published_at ? new Date(a.published_at).toLocaleDateString('pt-BR') : 'N/A'
      const corpo = cleanText(a.content) || a.excerpt || '(sem texto disponível)'
      return `## ${i + 1}. ${a.title}\nVeículo: ${veiculo} · Data: ${data} · ${a.url}\n\n${corpo}`
    })
    .join('\n\n---\n\n')

  const text = `${systemPrompt}

============================================================
DADOS DO MÊS (cole tudo isto no Claude Code para gerar o relatório)
============================================================

${inputs}
${contextBlock ? `\n${contextBlock}\n` : ''}
MATÉRIAS MONITORADAS NO MÊS (${articles.length} itens):

${materias}
`

  return NextResponse.json({ text })
}
