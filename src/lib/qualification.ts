// Qualificação pelo prompt mestre, sob demanda (Fase 22). Decisão do dono em
// 17/11/2026: a IA só roda quando ele for gerar o relatório. Enquanto a chave
// não estiver ligada, o mesmo trabalho sai como um PACOTE (.md) para colar
// num chat do Claude e a resposta volta por "Importar qualificação". Os dois
// caminhos gravam igual e passam pela mesma validação (validateDecisions:
// só id enviado e tema da lista).

import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { monthlyTaggedArticles } from '@/lib/report-drafts'
import { buildMasterClassifyPrompt, validateDecisions, type MasterClassifyArticle, type MasterClassifyClient, type MasterDecision } from '@/lib/ai/classify-master'
import { safeExternalUrl } from '@/lib/url'
import { linkStatus } from '@/lib/report-selection'

export interface QualificationItem extends MasterClassifyArticle {
  date: string | null
  url: string | null
  link_status: string
  status: string
  source: string | null
  tema: string | null
  cita_cliente: boolean | null
}

/** Resumo curto: o pacote leva referência, não a íntegra (sources.access_mode). */
const EXCERPT_CHARS = 280

export async function loadQualificationItems(supabase: SupabaseClient, clientId: string, period: string): Promise<QualificationItem[]> {
  const rows = await monthlyTaggedArticles(supabase, clientId, period)
  return rows
    // Decisão de pessoa não volta para a IA; excluído por pessoa também não.
    .filter((row) => row.classification_source !== 'humano' && row.monitoring_status !== 'excluido')
    .map((row) => {
      const article = row.articles
      const url = safeExternalUrl((article as { resolved_url?: string | null }).resolved_url || article.url)
      return {
        id: article.id,
        title: article.title,
        excerpt: (article.excerpt || '').slice(0, EXCERPT_CHARS) || null,
        publisher: article.publisher || article.sources?.name || null,
        date: article.published_at,
        url,
        link_status: linkStatus(url),
        status: row.monitoring_status ?? 'revisao',
        source: row.classification_source ?? null,
        tema: row.tema ?? null,
        cita_cliente: row.cita_cliente ?? null,
      }
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

const cell = (text: string | null | undefined) => (text || '—').replace(/\s+/g, ' ').replace(/\|/g, '/').replace(/[[\]]/g, '')

export function buildQualificationPackage(client: MasterClassifyClient, period: string, items: QualificationItem[]): string {
  const json = items.map((item) => ({ id: item.id, veiculo: item.publisher, data: item.date?.slice(0, 10) ?? null, titulo: item.title, resumo: item.excerpt, link: item.url }))
  return [
    `# Qualificação de ${client.name} — ${period}`,
    '',
    `${items.length} matérias marcadas para o cliente no mês (fora as decididas por pessoa). Cole este arquivo inteiro num chat do Claude, peça para seguir as instruções e cole a resposta em "Importar qualificação", na preparação do relatório.`,
    '',
    '## Instruções (prompt mestre de classificação)',
    '',
    buildMasterClassifyPrompt(client),
    '',
    '## Formato da resposta',
    '',
    'Responda SOMENTE com um JSON neste formato, uma decisão por matéria, usando o `id` exato de cada uma:',
    '',
    '```json',
    '{"decisoes":[{"article_id":"<id>","relevante":true,"cita_cliente":false,"tema":"<um tema da lista ou null>","tom":"neutro","motivo":"frase curta"}]}',
    '```',
    '',
    '## Matérias (tabela para leitura)',
    '',
    '| Data | Veículo | Título | Link | Marcação atual |',
    '|---|---|---|---|---|',
    ...items.map((item) => `| ${item.date?.slice(0, 10) ?? 's/d'} | ${cell(item.publisher)} | ${cell(item.title)} | ${item.url && item.link_status === 'exato' ? item.url : `(${item.link_status})`} | ${item.status}${item.tema ? ` · ${cell(item.tema)}` : ''} |`),
    '',
    '## Matérias (dados para classificar)',
    '',
    '<materias>',
    JSON.stringify(json),
    '</materias>',
    '',
  ].join('\n')
}

export const importSchema = z.object({
  decisoes: z
    .array(
      z.object({
        article_id: z.string().max(64),
        relevante: z.boolean(),
        cita_cliente: z.boolean(),
        tema: z.string().max(300).nullable(),
        tom: z.enum(['positivo', 'neutro', 'negativo']),
        motivo: z.string().max(600),
      })
    )
    .max(2000),
})

/**
 * Grava as decisões validadas. Nunca sobrescreve etiqueta de pessoa (filtro
 * por classification_source no UPDATE, não só na leitura).
 */
export async function applyDecisions(supabase: SupabaseClient, clientId: string, decisions: MasterDecision[]): Promise<number> {
  let updated = 0
  const now = new Date().toISOString()
  for (const decision of decisions) {
    const { data, error } = await supabase
      .from('article_client_tags')
      .update({
        classification_source: 'ia',
        // Irrelevante sai da tela sem apagar: 'excluido' é reversível na curadoria.
        monitoring_status: decision.relevante ? (decision.cita_cliente ? 'confirmado' : 'candidato') : 'excluido',
        cita_cliente: decision.cita_cliente,
        tema: decision.tema,
        tom: decision.tom,
        impact_summary: decision.motivo.slice(0, 300),
        classified_at: now,
      })
      .eq('article_id', decision.article_id)
      .eq('client_id', clientId)
      .neq('classification_source', 'humano')
      .select('article_id')
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (data) updated++
  }
  return updated
}

export { validateDecisions }
