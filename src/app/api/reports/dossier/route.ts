import { NextResponse } from 'next/server'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type ReportClient, type ReportMetadata } from '@/lib/ai/claude'
import { reportCreateSchema, formatZodError } from '@/lib/validation'
import { fetchArticleText } from '@/lib/fetcher/extract'
import { computePanorama, type PanoramaRow } from '@/lib/panorama'
import type { Article, Tom, Relevancia, SourceCategoria } from '@/types'

const TOM_LABEL: Record<Tom, string> = { positivo: 'Positivo', neutro: 'Neutro', negativo: 'Negativo', critico: 'Crítico' }
const REL_LABEL: Record<Relevancia, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_CHARS_PER_ARTICLE = 4000
// Enrich articles whose stored body is thinner than this (mostly Google News
// items, which arrive as title-only) by fetching the real page text. Bounded to
// fit the 60s budget; results are cached back into `content`.
const THIN_MIN = 600
// Google News items take up to 3 fetches to resolve (params + decode + article);
// cap + concurrency chosen so the enrichment pass stays well under 60s.
const ENRICH_CAP = 20
const ENRICH_CONCURRENCY = 10
const ENRICH_TIMEOUT_MS = 6000

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

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString('pt-BR') : 'N/A'
}

const veiculoOf = (a: { publisher?: string | null; sources?: { name?: string } | null }) =>
  a.publisher || a.sources?.name || 'Desconhecida'

// "Institucional — X" feeds are institutional/regulator sources; everything else
// is press. Mirrors the report's "tipo de fonte" panorama.
const isInstitucional = (a: { sources?: { name?: string } | null }) =>
  (a.sources?.name || '').startsWith('Institucional')

function csvCell(v: string): string {
  return `"${(v || '').replace(/"/g, '""')}"`
}

const HANDOFF = `## HANDOFF DE DESIGN (cole no Claude Design junto do relatório final)

Você recebeu o conteúdo final e aprovado de um relatório. Diagrame-o em PDF no design fornecido, **sem alterar, acrescentar ou remover informação**:
- Não invente nem edite nenhum número, nome, data, citação ou fonte. Mantenha campos \`[A PREENCHER]\` como estão.
- Preserve as citações no formato \`(Veículo, dd/mm/aaaa)\` — são a base factual.
- Hierarquia: \`#\` = capa; \`##\` = seções numeradas; \`###\` = subseções; corpo em prosa justificada.
- Renderize as tabelas como tabelas de verdade. Na Base de Evidências, aplique cor de fundo por tom: Positivo = verde claro; Neutro = branco; Negativo = vermelho claro; Crítico = laranja claro.
- Blocos "Leitura estratégica:" com leve destaque (itálico/filete/fundo sutil).
- Rodapé em todas as páginas + número de página. Idioma pt-BR. Página A4.`

// Builds a self-contained Markdown briefing PACKAGE (master prompt + inputs +
// pre-computed panorama + full item table + full-text of the priority subset +
// previous month's report + design handoff) to paste into Claude Code. No AI here.
export async function POST(req: Request) {
  const supabase = createClient()
  const body = await req.json().catch(() => null)
  const parsed = reportCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }
  const { prompt, article_ids, metadata, client_id } = parsed.data
  // Full month set for the item table + panorama (falls back to the priority set).
  const rawTableIds = (body as { table_ids?: unknown } | null)?.table_ids
  const tableIds: string[] =
    Array.isArray(rawTableIds) && rawTableIds.length ? (rawTableIds as string[]) : article_ids

  // Priority subset (full text). Light rows for the whole table/panorama.
  const [{ data: articles }, { data: tableData }] = await Promise.all([
    supabase.from('articles').select('*, sources(name)').in('id', article_ids),
    supabase
      .from('articles')
      .select('id, title, url, publisher, published_at, sources(name, categoria)')
      .in('id', tableIds)
      .order('published_at', { ascending: false, nullsFirst: false }),
  ])
  if (!articles?.length) return NextResponse.json({ error: 'No articles found' }, { status: 400 })
  const tableRows: Article[] = (tableData as unknown as Article[]) || (articles as Article[])

  let client: ReportClient | null = null
  let prevReport: { content: string; mes?: string } | null = null
  // Reputational tags for the deterministic panorama (tom/relevância/cita).
  const tagMap = new Map<string, { tom: Tom | null; relevancia: Relevancia | null; cita_cliente: boolean | null }>()
  if (client_id) {
    const [{ data: c }, { data: reports }, { data: tags }] = await Promise.all([
      supabase.from('clients').select('name, context, report_prompt, sector, contratante').eq('id', client_id).single(),
      supabase
        .from('reports')
        .select('content, metadata, created_at')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('article_client_tags')
        .select('article_id, tom, relevancia, cita_cliente')
        .eq('client_id', client_id)
        .in('article_id', tableIds),
    ])
    client = (c as ReportClient) || null
    const r = reports?.[0] as { content?: string; metadata?: { mes?: string } } | undefined
    if (r?.content) prevReport = { content: r.content, mes: r.metadata?.mes }
    for (const t of (tags as { article_id: string; tom: Tom | null; relevancia: Relevancia | null; cita_cliente: boolean | null }[] | null) || []) {
      tagMap.set(t.article_id, { tom: t.tom, relevancia: t.relevancia, cita_cliente: t.cita_cliente })
    }
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

  // ---- Panorama quantitativo (determinístico a partir da curadoria) ----
  // Categoria da fonte: usa a coluna quando existir; senão cai na heurística de
  // nome ("Institucional — …"), preservando o comportamento anterior.
  const total = tableRows.length
  const categoriaOf = (a: Article): SourceCategoria =>
    (a.sources?.categoria as SourceCategoria) || (isInstitucional(a) ? 'institucional' : 'imprensa')
  const pano = computePanorama(
    tableRows.map((a): PanoramaRow => {
      const t = tagMap.get(a.id)
      return { tom: t?.tom ?? null, relevancia: t?.relevancia ?? null, cita_cliente: t?.cita_cliente ?? null, categoria: categoriaOf(a) }
    })
  )
  const byVeiculo = new Map<string, number>()
  for (const a of tableRows) byVeiculo.set(veiculoOf(a), (byVeiculo.get(veiculoOf(a)) || 0) + 1)
  const dates = tableRows.map((a) => a.published_at).filter(Boolean).sort() as string[]
  const topVeiculos = Array.from(byVeiculo.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `- ${n}: ${c}`)
    .join('\n')
  const panorama = [
    pano.tagged
      ? 'PANORAMA QUANTITATIVO (pré-computado a partir da curadoria — determinístico):'
      : 'PANORAMA QUANTITATIVO (pré-computado; classifique tom/relevância na análise):',
    `- Total de itens monitorados: ${total}`,
    `- Por tipo de fonte: Imprensa ${pano.porTipoFonte.imprensa} · Institucional/regulador ${pano.porTipoFonte.institucional} · Agentes do setor ${pano.porTipoFonte.agente}`,
    pano.tagged
      ? `- Por tom: Positivos ${pano.porTom.positivo} · Neutros ${pano.porTom.neutro} · Negativos ${pano.porTom.negativo} · Críticos ${pano.porTom.critico}${pano.semTom ? ` · Sem classificação ${pano.semTom}` : ''}`
      : '',
    pano.tagged
      ? `- Por relevância: Alta ${pano.porRelevancia.alta} · Média ${pano.porRelevancia.media} · Baixa ${pano.porRelevancia.baixa}${pano.semRelevancia ? ` · Sem classificação ${pano.semRelevancia}` : ''}`
      : '',
    pano.citamCliente || pano.sobOutroProtagonista
      ? `- Menção ao cliente: Citam o cliente ${pano.citamCliente} · Tema sob outro protagonista ${pano.sobOutroProtagonista}${pano.semCitacao ? ` · Sem classificação ${pano.semCitacao}` : ''}`
      : '',
    dates.length ? `- Período coberto: ${fmtDate(dates[0])} a ${fmtDate(dates[dates.length - 1])}` : '',
    '- Por veículo:',
    topVeiculos,
  ]
    .filter(Boolean)
    .join('\n')

  // ---- Tabela completa de itens (vira a base .xlsx) ----
  const tomOf = (id: string) => {
    const t = tagMap.get(id)?.tom
    return t ? TOM_LABEL[t] : ''
  }
  const relOf = (id: string) => {
    const t = tagMap.get(id)?.relevancia
    return t ? REL_LABEL[t] : ''
  }
  const citaOf = (id: string) => {
    const c = tagMap.get(id)?.cita_cliente
    return c === true ? 'Sim' : c === false ? 'Não' : ''
  }

  const tabela = [
    '| Nº | Data | Veículo | Título | Tom | Relev. | Cita | URL |',
    '|---|---|---|---|---|---|---|---|',
    ...tableRows.map((a, i) => {
      const titulo = (a.title || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
      return `| ${i + 1} | ${fmtDate(a.published_at)} | ${veiculoOf(a)} | ${titulo} | ${tomOf(a.id)} | ${relOf(a.id)} | ${citaOf(a.id)} | ${a.url} |`
    }),
  ].join('\n')

  const csv = [
    'Nº,Data,Veículo,Título,Tom,Relevância,Cita cliente,URL',
    ...tableRows.map((a, i) =>
      [
        String(i + 1),
        fmtDate(a.published_at),
        veiculoOf(a),
        (a.title || '').replace(/\s+/g, ' ').trim(),
        tomOf(a.id),
        relOf(a.id),
        citaOf(a.id),
        a.url || '',
      ]
        .map(csvCell)
        .join(',')
    ),
  ].join('\n')

  // ---- Enriquecer o subconjunto prioritário com texto completo ----
  const arr = articles as Article[]
  const thin = arr.filter((a) => a.url && cleanText(a.content).length < THIN_MIN).slice(0, ENRICH_CAP)
  const enriched = new Map<string, string>()
  for (let i = 0; i < thin.length; i += ENRICH_CONCURRENCY) {
    const batch = thin.slice(i, i + ENRICH_CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (a) => {
        const text = await fetchArticleText(a.url, ENRICH_TIMEOUT_MS)
        if (text && text.length > cleanText(a.content).length) enriched.set(a.id, text)
      })
    )
  }
  if (enriched.size) {
    await Promise.allSettled(
      Array.from(enriched).map(([id, content]) => supabase.from('articles').update({ content }).eq('id', id))
    )
  }

  const materias = arr
    .map((a, i) => {
      const data = fmtDate(a.published_at)
      const corpo = cleanText(enriched.get(a.id) ?? a.content) || a.excerpt || '(sem texto disponível)'
      return `## ${i + 1}. ${a.title}\nVeículo: ${veiculoOf(a)} · Data: ${data} · ${a.url}\n\n${corpo}`
    })
    .join('\n\n---\n\n')

  const prevBlock = prevReport
    ? `============================================================
RELATÓRIO DO MÊS ANTERIOR${prevReport.mes ? ` (${prevReport.mes})` : ''} — use para a "evolução vs. mês anterior"
============================================================

${prevReport.content}
`
    : ''

  const text = `${systemPrompt}

============================================================
PACOTE DE BRIEFING${client ? ` — ${client.name}` : ''} (cole tudo isto no Claude Code)
============================================================

${inputs}
${contextBlock ? `\n${contextBlock}\n` : ''}
${panorama}

============================================================
ITENS MONITORADOS NO MÊS (${total}) — tabela completa (também disponível em CSV)
============================================================

${tabela}

============================================================
MATÉRIAS PRIORITÁRIAS — texto completo (${arr.length}) para análise e verificação
============================================================

${materias}

${prevBlock}
============================================================
${HANDOFF}
`

  return NextResponse.json({ text, csv })
}
