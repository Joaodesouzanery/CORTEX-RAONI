import type {
  ArticleSnapshot,
  EditorialReviewState,
  GeographicScope,
  QualityFlag,
  ReportRole,
  StrategicEffect,
  VerificationStatus,
} from '@/types'
import { deterministicQualityFlags, inferGeographicScope } from '@/lib/report-quality'

export interface TriageDecision {
  article_id: string
  report_role: ReportRole
  editorial_score: number
  editorial_reason: string
  cluster_label: string
  central_message: string
  impact_summary: string
  strategic_effect: StrategicEffect
  recommended_action: string
  verification_status: VerificationStatus
  editorial_review_state: EditorialReviewState
  editorial_confidence: number
  geographic_scope: GeographicScope
  quality_flags: QualityFlag[]
}

function fallback(articles: ArticleSnapshot[]): TriageDecision[] {
  return articles.map((article) => {
    const geographicScope = inferGeographicScope(article)
    return {
      article_id: article.id,
      report_role: 'contexto',
      editorial_score: 35,
      editorial_reason: 'Sem IA: mantida conservadoramente no anexo para revisão.',
      cluster_label: 'Revisão pendente',
      central_message: article.excerpt || article.title,
      impact_summary: 'Impacto ainda não validado por análise editorial.',
      strategic_effect: 'informativo',
      recommended_action: 'Revisar a publicação antes do fechamento mensal.',
      verification_status: 'pendente',
      editorial_review_state: 'pendente',
      editorial_confidence: 0,
      geographic_scope: geographicScope,
      quality_flags: deterministicQualityFlags(article, geographicScope),
    }
  })
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
    system: `Você faz triagem editorial conservadora de inteligência reputacional para ${client.name}, no setor ${client.sector || 'informado pelo cliente'}.
Classifique cada publicação sem eliminar itens. Use:
- evidencia: fato ou análise diretamente útil às seções estratégicas, com impacto específico e explicável para o cliente;
- contexto: cobertura adjacente/baixa confiança, útil apenas no anexo;
- ruido: sem impacto concreto, entretenimento, loteria, consumo, esporte ou exterior desconectado.
Não promova uma matéria apenas porque contém uma palavra ampla do setor. Pontue de 0 a 100 e informe editorial_confidence entre 0 e 1. Matéria principal não é escolhida por você. Veículos diferentes permanecem distintos.
geographic_scope deve ser para, amazonia, brasil, internacional ou indeterminado.
quality_flags pode conter: texto_insuficiente, possivel_mercado_financeiro, ambiguidade_criptomoeda, energia_nuclear_desconectada, equipamento_comercial, exterior_sem_impacto_local ou divergencia_de_classificacao.
Para SIMINERAL, priorize Pará/Amazônia, menções institucionais, regulação mineral, ANM/CFEM/licenciamento, minerais críticos, sustentabilidade, comunidades e infraestrutura. Brasil ou exterior só são evidência se houver impacto estratégico concreto para o setor mineral paraense. Bolsa, cotação, criptomoeda, produto/equipamento e exterior desconectado são contexto ou ruído.
Para cada item, produza também uma ficha estratégica objetiva:
- central_message: o fato/sinal factual principal, sem interpretação;
- impact_summary: por que isso importa especificamente para o cliente;
- strategic_effect: oportunidade, risco, misto ou informativo;
- recommended_action: ação concreta de comunicação ou monitoramento;
- verification_status: verificada quando há texto integral e fonte identificável, parcial quando há somente trecho, pendente quando os metadados são insuficientes;
- editorial_review_state: pendente para baixa confiança, conflito ou possível menção direta; automático nos demais. Nunca marque como revisado.
Responda somente JSON válido: [{"article_id":"uuid","report_role":"evidencia|contexto|ruido","editorial_score":0,"editorial_confidence":0.0,"geographic_scope":"para|amazonia|brasil|internacional|indeterminado","quality_flags":[],"editorial_reason":"frase curta","cluster_label":"pauta","central_message":"fato","impact_summary":"impacto","strategic_effect":"oportunidade|risco|misto|informativo","recommended_action":"ação","verification_status":"verificada|parcial|pendente","editorial_review_state":"automatico|pendente"}].`,
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
        central_message: String(decision.central_message || article.excerpt || article.title).slice(0, 3000),
        impact_summary: String(decision.impact_summary || 'Impacto não detalhado.').slice(0, 3000),
        strategic_effect: ['oportunidade', 'risco', 'misto', 'informativo'].includes(decision.strategic_effect)
          ? decision.strategic_effect
          : 'informativo',
        recommended_action: String(decision.recommended_action || 'Manter em monitoramento.').slice(0, 3000),
        verification_status: ['verificada', 'parcial', 'pendente'].includes(decision.verification_status)
          ? decision.verification_status
          : 'pendente',
        editorial_review_state:
          decision.editorial_review_state === 'pendente'
            ? ('pendente' as const)
            : ('automatico' as const),
        editorial_confidence: Math.max(
          0,
          Math.min(1, Number.isFinite(decision.editorial_confidence) ? decision.editorial_confidence : 0)
        ),
        geographic_scope: ['para', 'amazonia', 'brasil', 'internacional', 'indeterminado'].includes(
          decision.geographic_scope
        )
          ? decision.geographic_scope
          : inferGeographicScope(article),
        quality_flags: Array.from(
          new Set([
            ...deterministicQualityFlags(article),
            ...(Array.isArray(decision.quality_flags)
              ? decision.quality_flags.filter((flag): flag is QualityFlag =>
                  [
                    'texto_insuficiente',
                    'duplicata_exata',
                    'possivel_mercado_financeiro',
                    'ambiguidade_criptomoeda',
                    'energia_nuclear_desconectada',
                    'equipamento_comercial',
                    'exterior_sem_impacto_local',
                    'fora_do_periodo',
                    'divergencia_de_classificacao',
                    'agenda_obrigatoria',
                  ].includes(flag)
                )
              : []),
          ])
        ),
      }
    })
    return { decisions, source: 'ia' }
  } catch {
    return { decisions: fallback(articles), source: 'regra' }
  }
}
