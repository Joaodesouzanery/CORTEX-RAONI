import type { EvidenceCitation, MethodologySnapshot, ReportEvidenceItem, ReportSection } from '@/types'

/**
 * Extrai o relatório para JSON parseando o markdown que NÓS ditamos.
 *
 * Deliberadamente não é uma segunda geração pelo modelo: isso duplicaria custo,
 * criaria duas fontes de verdade que divergem na primeira edição humana (o
 * consultor edita `report_sections.content`, não um JSON paralelo) e entregaria
 * ao design um artefato que nunca passou pelo portão de qualidade.
 *
 * O contrato é o formato fixado em `MASTER_SYSTEM_PROMPT` e travado por
 * `auditReportStructure`. Quando o lint passa, todo campo abaixo vem preenchido;
 * quando uma seção ainda não foi gerada, o campo vem vazio em vez de inventado.
 */

export interface ReportRisk {
  nome: string
  probabilidade: string
  impacto: string
  sinal: string
  leitura: string
}

export interface ReportTheme {
  tema: string
  relevancia: string
  sinal: string
}

export interface ReportScenario {
  numero: string
  nome: string
  descricao: string
  resposta: string
}

export interface ReportInsight {
  tese: string
  explicacao: string
}

export interface ReportStructure {
  numero_do_mes: { valor: string; explicacao: string } | null
  insights: ReportInsight[]
  temas: ReportTheme[]
  riscos: ReportRisk[]
  oportunidades: { nome: string; descricao: string }[]
  recomendacoes: { horizonte: string; prazo: string; acoes: string[] }[]
  cenarios: ReportScenario[]
  linha_do_tempo: { data: string; titulo: string; veiculo: string; mensagem: string | null }[]
  evidencias: EvidenceCitation[]
  metodologia: MethodologySnapshot | null
  service_metrics: Record<string, number> | null
}

const lines = (content: string) =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

function sectionContent(sections: ReportSection[], key: number) {
  return sections.find((section) => section.section_key === key)?.content || ''
}

/** Remove negrito, itálico e citações — o design renderiza o texto, não o markdown. */
function plain(value: string) {
  return value
    .replace(/\*\*/g, '')
    .replace(/^[-*]\s+/, '')
    .trim()
}

function parseNumeroDoMes(content: string): ReportStructure['numero_do_mes'] {
  const all = lines(content)
  const index = all.findIndex((line) => /^#{2,4}\s*O NÚMERO DO MÊS/i.test(line))
  if (index < 0) return null
  const body = all[index + 1]
  if (!body || /^#{2,4}\s/.test(body)) return null
  // "**R$ 4,2 bilhões** — explicação [E012]": o negrito é o valor-âncora.
  const bold = body.match(/^\*\*(.+?)\*\*/)
  const rest = bold ? body.slice(bold[0].length) : body
  return { valor: bold ? bold[1].trim() : '', explicacao: plain(rest.replace(/^\s*[—-]\s*/, '')) }
}

function parseInsights(content: string): ReportInsight[] {
  const all = lines(content)
  const insights: ReportInsight[] = []
  for (const [index, line] of all.entries()) {
    const match = line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*(.*)$/)
    if (!match) continue
    const next = all[index + 1] || ''
    // A explicação é a linha seguinte, exceto quando ela já é o próximo insight
    // ou um cabeçalho — o modelo às vezes fecha as duas partes na mesma linha.
    const trailing = match[2].trim()
    const continuation = /^\d+\.\s/.test(next) || /^#{1,6}\s/.test(next) ? '' : plain(next)
    insights.push({ tese: match[1].trim(), explicacao: trailing || continuation })
  }
  return insights
}

function tableRows(content: string) {
  return lines(content)
    .filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|?$/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()).filter((cell, index, cells) => !(index === 0 && !cell) && !(index === cells.length - 1 && !cell)))
}

function parseTemas(content: string): ReportTheme[] {
  const rows = tableRows(content).filter((cells) => cells.length >= 3)
  const body = rows.length && /RELEV/i.test(rows[0][1] || '') ? rows.slice(1) : rows
  return body.map((cells) => ({ tema: plain(cells[0]), relevancia: plain(cells[1]), sinal: plain(cells[2]) }))
}

function parseRiscos(content: string): ReportRisk[] {
  const all = lines(content)
  const riscos: ReportRisk[] = []
  for (const [index, line] of all.entries()) {
    const head = line.match(/^\*\*Risco\s+\d+\s*[—-]\s*(.+?)\*\*$/i)
    if (!head) continue
    const window = all.slice(index + 1, index + 6)
    const pick = (pattern: RegExp) => {
      const found = window.find((candidate) => pattern.test(candidate))
      return found ? plain(found.replace(pattern, '')) : ''
    }
    const sinal = pick(/^Sinal do mês\s*[—:-]\s*/i)
    const leitura = window.find(
      (candidate) => !/^(Probabilidade|Impacto|Sinal do mês)/i.test(candidate) && !/^\*\*/.test(candidate)
    )
    riscos.push({
      nome: head[1].trim(),
      probabilidade: pick(/^Probabilidade:\s*/i),
      impacto: pick(/^Impacto:\s*/i),
      sinal,
      leitura: leitura ? plain(leitura) : '',
    })
  }
  return riscos
}

function parseOportunidades(content: string) {
  const all = lines(content)
  const out: { nome: string; descricao: string }[] = []
  for (const [index, line] of all.entries()) {
    const head = line.match(/^\*\*Oportunidade\s+\d+\s*[—-]\s*(.+?)\*\*$/i)
    if (!head) continue
    const next = all[index + 1]
    out.push({ nome: head[1].trim(), descricao: next && !/^\*\*/.test(next) ? plain(next) : '' })
  }
  return out
}

const HORIZONS: { pattern: RegExp; horizonte: string; prazo: string }[] = [
  { pattern: /AÇÕES IMEDIATAS/i, horizonte: 'imediatas', prazo: '0-15 dias' },
  { pattern: /AÇÕES DE CURTO PRAZO/i, horizonte: 'curto_prazo', prazo: '15-60 dias' },
  { pattern: /AÇÕES DE MÉDIO PRAZO/i, horizonte: 'medio_prazo', prazo: '2-6 meses' },
]

function parseRecomendacoes(content: string) {
  const all = lines(content)
  return HORIZONS.map(({ pattern, horizonte, prazo }) => {
    const start = all.findIndex((line) => /^###\s/.test(line) && pattern.test(line))
    if (start < 0) return { horizonte, prazo, acoes: [] }
    const acoes: string[] = []
    for (const line of all.slice(start + 1)) {
      if (/^#{2,3}\s/.test(line)) break
      if (/^[-*]\s+/.test(line)) acoes.push(plain(line))
    }
    return { horizonte, prazo, acoes }
  })
}

function parseCenarios(content: string): ReportScenario[] {
  const all = lines(content)
  const cenarios: ReportScenario[] = []
  for (const [index, line] of all.entries()) {
    const head = line.match(/^\*\*CENÁRIO\s+(\d{2})\s*[—-]\s*(.+?)\*\*$/i)
    if (!head) continue
    const window = all.slice(index + 1, index + 5)
    const resposta = window.find((candidate) => /^\*\*Resposta recomendada:\*\*/i.test(candidate))
    const descricao = window.find((candidate) => !/^\*\*/.test(candidate))
    cenarios.push({
      numero: head[1],
      nome: head[2].trim(),
      descricao: descricao ? plain(descricao) : '',
      resposta: resposta ? plain(resposta.replace(/^\*\*Resposta recomendada:\*\*/i, '')) : '',
    })
  }
  return cenarios
}

export interface ReportStructureInput {
  sections: ReportSection[]
  citations?: EvidenceCitation[]
  methodology?: MethodologySnapshot | null
  timeline?: { data: string; titulo: string; veiculo: string; mensagem: string | null }[]
  serviceMetrics?: Record<string, number> | null
}

/**
 * Linha do tempo a partir da própria base qualificada — não do texto gerado.
 * O design precisa de datas ordenadas; o markdown só tem datas em prosa.
 */
export function timelineFromEvidence(items: ReportEvidenceItem[]) {
  return items
    .filter((item) => item.bucket === 'qualified' && item.article_snapshot.published_at)
    .sort((a, b) => String(a.article_snapshot.published_at).localeCompare(String(b.article_snapshot.published_at)))
    .map((item) => ({
      data: String(item.article_snapshot.published_at).slice(0, 10),
      titulo: String(item.article_snapshot.title),
      veiculo: String(item.article_snapshot.publisher || item.article_snapshot.source_name || ''),
      mensagem: item.classification_snapshot.central_message ? String(item.classification_snapshot.central_message) : null,
    }))
}

export function buildReportStructure(input: ReportStructureInput): ReportStructure {
  const { sections } = input
  const s1 = sectionContent(sections, 1)
  return {
    numero_do_mes: parseNumeroDoMes(s1),
    insights: parseInsights(s1),
    temas: parseTemas(sectionContent(sections, 2)),
    riscos: parseRiscos(sectionContent(sections, 5)),
    oportunidades: parseOportunidades(sectionContent(sections, 6)),
    recomendacoes: parseRecomendacoes(sectionContent(sections, 7)),
    cenarios: parseCenarios(sectionContent(sections, 8)),
    linha_do_tempo: input.timeline || [],
    evidencias: input.citations || [],
    metodologia: input.methodology || null,
    service_metrics: input.serviceMetrics || null,
  }
}
