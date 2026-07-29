import type { ArticleSnapshot, ReportRole } from '@/types'

export interface TriageDecision {
  article_id: string
  report_role: ReportRole
  editorial_score: number
  editorial_reason: string
  cluster_label: string
}

function fallback(articles: ArticleSnapshot[]): TriageDecision[] {
  return articles.map((article) => ({
    article_id: article.id,
    report_role: 'contexto',
    editorial_score: 45,
    editorial_reason: 'Triagem conservadora aplicada sem IA; requer revisão editorial.',
    cluster_label: 'Revisão pendente',
  }))
}

export async function triageEvidence(
  articles: ArticleSnapshot[],
  client: { name: string; sector: string | null; context: string | null }
): Promise<{ decisions: TriageDecision[]; source: 'ia' | 'regra' }> {
  if (!process.env.ANTHROPIC_API_KEY) return { decisions: fallback(articles), source: 'regra' }
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const input = articles.map((article) => ({
    id: article.id,
    title: article.title,
    publisher: article.publisher || article.source_name,
    date: article.published_at,
    text: (article.content || article.excerpt || '').slice(0, 3500),
  }))
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    system: `Você faz triagem editorial de inteligência reputacional para ${client.name}, no setor ${client.sector || 'informado pelo cliente'}.
Classifique cada publicação sem eliminar itens. Use:
- evidencia: fato ou análise diretamente útil às seções estratégicas;
- contexto: cobertura adjacente/baixa confiança, útil apenas no anexo;
- ruido: sem impacto concreto, entretenimento, loteria, consumo, esporte ou exterior desconectado.
Pontue de 0 a 100. Matéria principal não é escolhida por você. Veículos diferentes permanecem distintos.
Responda somente JSON válido: [{"article_id":"uuid","report_role":"evidencia|contexto|ruido","editorial_score":0,"editorial_reason":"frase curta","cluster_label":"pauta"}].`,
    messages: [
      {
        role: 'user',
        content: `${client.context || ''}\n\nPUBLICAÇÕES:\n${JSON.stringify(input)}`,
      },
    ],
  })
  const text = message.content.find((block) => block.type === 'text')
  if (!text || text.type !== 'text') return { decisions: fallback(articles), source: 'regra' }
  try {
    const raw = text.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw) as TriageDecision[]
    const byId = new Map(parsed.map((decision) => [decision.article_id, decision]))
    const decisions = articles.map((article) => {
      const decision = byId.get(article.id)
      if (
        !decision ||
        !['evidencia', 'contexto', 'ruido'].includes(decision.report_role) ||
        !Number.isFinite(decision.editorial_score)
      ) {
        return fallback([article])[0]
      }
      return {
        article_id: article.id,
        report_role: decision.report_role,
        editorial_score: Math.max(0, Math.min(100, Math.round(decision.editorial_score))),
        editorial_reason: String(decision.editorial_reason || 'Classificação editorial por IA.').slice(0, 1000),
        cluster_label: String(decision.cluster_label || 'Sem cluster').slice(0, 200),
      }
    })
    return { decisions, source: 'ia' }
  } catch {
    return { decisions: fallback(articles), source: 'regra' }
  }
}

