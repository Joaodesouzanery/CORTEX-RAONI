import { REPORT_SECTION_GROUPS } from './report-sections'
import type { Article } from '@/types'

// Client-side orchestration of the sectioned report generation. Shared by the
// single-report builder and the batch flow so the logic stays in one place.

export interface ReportMetadataInput {
  mes: string
  reunioes_presenciais: number
  reunioes_virtuais: number
  orientacoes: number
  acoes_imprensa: number
}

export interface ReportBasePayload {
  prompt: string
  article_ids: string[]
  client_id: string | null
  metadata: ReportMetadataInput
}

const DEFAULT_CONTRATANTE = 'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA'

// The fixed report structure (sections 1-9 are AI-generated; 10 is deterministic).
const SECTION_TITLES = [
  '1. SUMÁRIO EXECUTIVO',
  '2. TEMAS ESTRATÉGICOS DO MÊS',
  '3. LEITURA REPUTACIONAL DO AMBIENTE EXTERNO',
  '4. ANÁLISE TEMÁTICA APROFUNDADA',
  '5. RISCOS REPUTACIONAIS PRIORITÁRIOS',
  '6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL',
  '7. RECOMENDAÇÕES EXECUTIVAS',
  '8. CENÁRIOS PROSPECTIVOS',
  '9. DEMONSTRAÇÃO DOS SERVIÇOS',
]

// Section 10 (evidence base) built deterministically so every selected article
// is always listed — no reliance on the model to enumerate.
function buildEvidenceSection(articles: Article[]): string {
  const lines = articles
    .map((a, i) => {
      const veiculo = a.publisher || a.sources?.name || 'Desconhecida'
      const data = a.published_at ? new Date(a.published_at).toLocaleDateString('pt-BR') : ''
      return `${i + 1}. **${veiculo}** — ${a.title}${data ? ` (${data})` : ''}`
    })
    .join('\n')
  return `## 10. BASE QUALIFICADA DE EVIDÊNCIAS MONITORADAS NO MÊS\n\n${lines}`
}

/**
 * Cheap, AI-free preview of the report: header + the 10 section titles (1-9 as
 * placeholders) + the real deterministic evidence list — so the user can check
 * the structure and which articles will be cited before spending tokens.
 */
export function buildReportPreview(opts: {
  clienteNome?: string | null
  contratante?: string | null
  mes?: string
  articles: Article[]
}): string {
  const nome = opts.clienteNome?.trim() || 'a organização cliente'
  const contratante = opts.contratante?.trim() || DEFAULT_CONTRATANTE
  const mes = opts.mes?.trim() || '[mês de referência]'
  const header = `# RELATÓRIO MENSAL DE COMUNICAÇÃO ESTRATÉGICA E GESTÃO DE IMAGEM\n**${nome}**\n**${contratante}**\n**${mes}**\n**CONFIDENCIAL**`
  const note = '*Pré-visualização — as seções 1 a 9 serão geradas pela IA. Abaixo, a estrutura e as evidências (seção 10) que entrarão no relatório.*'
  const skeleton = SECTION_TITLES.map((t) => `## ${t}\n\n_[será gerado pela IA]_`).join('\n\n')
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const footer = `*${today}. Suporte Estratégico Prestado por: ${contratante}*`
  return [header, '---', note, skeleton, buildEvidenceSection(opts.articles), '---', footer].join('\n\n')
}

// One section group, with a per-call timeout (Hobby caps at 60s) and one retry.
async function postSection(
  basePayload: ReportBasePayload,
  groupId: number,
  prior: string | undefined,
  attempt = 1
): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 75000)
  try {
    const res = await fetch('/api/reports/section', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...basePayload, group: groupId, prior: prior ?? null }),
      signal: controller.signal,
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) throw new Error(data?.error || `Falha na seção ${groupId + 1}`)
    if (typeof data?.markdown !== 'string') throw new Error(`Resposta inválida na seção ${groupId + 1}`)
    return data.markdown
  } catch (e) {
    if (attempt < 2) return postSection(basePayload, groupId, prior, attempt + 1)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Generate the full report section group by section group (each request fits the
 * serverless time limit), then append the deterministic evidence base + footer.
 * Returns the assembled markdown — saving is the caller's responsibility.
 */
export async function runSectionedReport(opts: {
  basePayload: ReportBasePayload
  articles: Article[]
  contratante?: string | null
  onProgress?: (done: number, total: number, label: string) => void
}): Promise<string> {
  const { basePayload, articles, contratante, onProgress } = opts
  const total = REPORT_SECTION_GROUPS.length

  const parts: string[] = []
  for (let i = 0; i < total; i++) {
    const group = REPORT_SECTION_GROUPS[i]
    onProgress?.(i, total, group.label)
    const prior = parts.join('\n\n').slice(-3000) || undefined
    parts.push((await postSection(basePayload, group.id, prior)).trim())
  }
  onProgress?.(total, total, 'Finalizando')

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const footer = `*${today}. Suporte Estratégico Prestado por: ${contratante?.trim() || DEFAULT_CONTRATANTE}*`
  return [...parts, buildEvidenceSection(articles), '---', footer].join('\n\n').replace(/\n{3,}/g, '\n\n')
}
