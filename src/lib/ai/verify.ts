import type {
  ArticleSnapshot,
  GeographicScope,
  MonthlyReportTopic,
  QualityFlag,
  ReportRole,
  VerificationStatus,
} from '@/types'
import { deterministicQualityFlags, inferGeographicScope } from '@/lib/report-quality'

export interface EvidenceVerificationInput {
  article: ArticleSnapshot
  proposed_role: ReportRole
  proposed_reason: string | null
  proposed_impact: string | null
  proposed_confidence: number | null
  cita_cliente: boolean
  tom: string | null
  topic_ids: string[]
}

export interface EvidenceVerificationDecision {
  article_id: string
  accepted: boolean
  report_role: ReportRole
  editorial_confidence: number
  verification_status: VerificationStatus
  editorial_review_state: 'automatico' | 'pendente'
  geographic_scope: GeographicScope
  quality_flags: QualityFlag[]
  reason: string
}

function conservativeFallback(inputs: EvidenceVerificationInput[]): EvidenceVerificationDecision[] {
  return inputs.map(({ article }) => {
    const geographicScope = inferGeographicScope(article)
    return {
      article_id: article.id,
      accepted: false,
      report_role: 'contexto',
      editorial_confidence: 0,
      verification_status: article.content_status === 'integral' ? 'verificada' : 'parcial',
      editorial_review_state: 'pendente',
      geographic_scope: geographicScope,
      quality_flags: deterministicQualityFlags(article, geographicScope),
      reason: 'Verificação independente indisponível; item preservado no anexo.',
    }
  })
}

const ALLOWED_FLAGS: QualityFlag[] = [
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
]

export async function verifyEvidenceBatch(
  inputs: EvidenceVerificationInput[],
  client: { name: string; sector: string | null; context: string | null },
  topics: MonthlyReportTopic[]
): Promise<{ decisions: EvidenceVerificationDecision[]; source: 'ia' | 'regra' }> {
  if (!inputs.length) return { decisions: [], source: 'regra' }
  if (!process.env.ANTHROPIC_API_KEY) return { decisions: conservativeFallback(inputs), source: 'regra' }

  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const payload = inputs.map((input) => ({
    article_id: input.article.id,
    title: input.article.title,
    publisher: input.article.publisher || input.article.source_name,
    published_at: input.article.published_at,
    content_status: input.article.content_status,
    text: (input.article.content || input.article.excerpt || '').slice(0, 5000),
    proposed_role: input.proposed_role,
    proposed_reason: input.proposed_reason,
    proposed_impact: input.proposed_impact,
    proposed_confidence: input.proposed_confidence,
    cita_cliente: input.cita_cliente,
    tom: input.tom,
    topic_ids: input.topic_ids,
  }))
  const agenda = topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    rationale: topic.rationale,
    inclusion_terms: topic.inclusion_terms,
    exclusion_terms: topic.exclusion_terms,
  }))
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 5000,
    system: `Você é a segunda verificação independente de um relatório de inteligência reputacional para ${client.name}.
Não repita cegamente a primeira classificação. Confirme se o texto sustenta um impacto específico e útil para o cliente.
Aceite como evidencia somente com confiança >= 0,85. Palavra-chave ampla, bolsa, cotação, criptomoeda, produto/equipamento, energia nuclear desconectada e exterior sem consequência local não são evidência.
Para SIMINERAL, Pará/Amazônia são o eixo. Pautas nacionais e internacionais exigem consequência demonstrável para o setor mineral paraense.
Se houver apenas trecho, ambiguidade, menção direta, tom negativo/crítico ou item de agenda obrigatória, marque editorial_review_state como pendente.
Retorne apenas JSON: [{"article_id":"uuid","accepted":true,"report_role":"evidencia|contexto|ruido","editorial_confidence":0.9,"verification_status":"verificada|parcial|pendente","editorial_review_state":"automatico|pendente","geographic_scope":"para|amazonia|brasil|internacional|indeterminado","quality_flags":[],"reason":"..."}].`,
    messages: [
      {
        role: 'user',
        content: `${client.context || ''}\n\nAGENDA:\n${JSON.stringify(agenda)}\n\nPROPOSTAS:\n${JSON.stringify(payload)}`,
      },
    ],
  })
  const block = message.content.find((item) => item.type === 'text')
  if (!block || block.type !== 'text') return { decisions: conservativeFallback(inputs), source: 'regra' }
  try {
    const raw = block.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>
    const byId = new Map(parsed.map((decision) => [String(decision.article_id), decision]))
    return {
      source: 'ia',
      decisions: inputs.map((input) => {
        const rawDecision = byId.get(input.article.id)
        if (!rawDecision) return conservativeFallback([input])[0]
        const geographicScope = ['para', 'amazonia', 'brasil', 'internacional', 'indeterminado'].includes(
          String(rawDecision.geographic_scope)
        )
          ? (rawDecision.geographic_scope as GeographicScope)
          : inferGeographicScope(input.article)
        const confidence = Math.max(0, Math.min(1, Number(rawDecision.editorial_confidence) || 0))
        const accepted =
          rawDecision.accepted === true &&
          rawDecision.report_role === 'evidencia' &&
          confidence >= 0.85
        const qualityFlags = Array.from(
          new Set([
            ...deterministicQualityFlags(input.article, geographicScope),
            ...(Array.isArray(rawDecision.quality_flags)
              ? rawDecision.quality_flags.filter((flag): flag is QualityFlag =>
                  ALLOWED_FLAGS.includes(flag as QualityFlag)
                )
              : []),
            ...(input.topic_ids.length ? (['agenda_obrigatoria'] as QualityFlag[]) : []),
          ])
        )
        const exception =
          input.cita_cliente ||
          input.tom === 'negativo' ||
          input.tom === 'critico' ||
          input.topic_ids.length > 0 ||
          input.article.content_status !== 'integral'
        return {
          article_id: input.article.id,
          accepted,
          report_role: accepted ? 'evidencia' : rawDecision.report_role === 'ruido' ? 'ruido' : 'contexto',
          editorial_confidence: confidence,
          verification_status:
            rawDecision.verification_status === 'verificada' ||
            rawDecision.verification_status === 'parcial' ||
            rawDecision.verification_status === 'pendente'
              ? rawDecision.verification_status
              : input.article.content_status === 'integral'
                ? 'verificada'
                : 'parcial',
          editorial_review_state: exception || rawDecision.editorial_review_state === 'pendente' ? 'pendente' : 'automatico',
          geographic_scope: geographicScope,
          quality_flags: qualityFlags,
          reason: String(rawDecision.reason || 'Verificação editorial independente.').slice(0, 2000),
        }
      }),
    }
  } catch {
    return { decisions: conservativeFallback(inputs), source: 'regra' }
  }
}

