import type { ArticleSnapshot, ReportEvidenceItem } from '@/types'
import { deterministicQualityFlags, inferGeographicScope } from '@/lib/report-quality'
import type { TriageDecision } from '@/lib/ai/triage'

// Keeps the monthly pipeline moving when ANTHROPIC_API_KEY is not configured:
// promotes items whose already-computed keyword classification (from ingestion,
// see src/lib/client-relevance.ts) confirms a direct client mention, and leaves
// everything else in the annex for manual/AI review later.
export function ruleBasedTriageDecisions(batch: ReportEvidenceItem[]): TriageDecision[] {
  return batch.map((item) => {
    const article = item.article_snapshot as ArticleSnapshot
    const geographicScope = inferGeographicScope(article)
    const snapshot = item.classification_snapshot as {
      cita_cliente?: boolean
      monitoring_status?: string
      confidence?: number | null
      tema?: string | null
    }
    const qualifies = snapshot.cita_cliente === true && snapshot.monitoring_status === 'confirmado'
    if (qualifies) {
      return {
        article_id: item.article_id,
        report_role: 'evidencia',
        editorial_score: 80,
        editorial_reason: 'Classificação automática por regra: menção direta confirmada ao cliente na captação.',
        cluster_label: snapshot.tema || 'Menção direta',
        central_message: article.excerpt || article.title,
        impact_summary: 'Classificado por regra a partir da relevância já confirmada na captação; revisão editorial ainda recomendada.',
        strategic_effect: 'informativo',
        recommended_action: 'Revisar manualmente para refinar a leitura estratégica.',
        verification_status: 'verificada',
        editorial_review_state: 'automatico',
        editorial_confidence: Math.max(0.85, Math.min(1, snapshot.confidence ?? 0.85)),
        geographic_scope: geographicScope,
        quality_flags: deterministicQualityFlags(article, geographicScope),
      }
    }
    return {
      article_id: item.article_id,
      report_role: 'contexto',
      editorial_score: 35,
      editorial_reason: 'Sem IA configurada: mantida no anexo até triagem manual ou configuração da IA.',
      cluster_label: 'Revisão pendente',
      central_message: article.excerpt || article.title,
      impact_summary: 'Impacto ainda não avaliado.',
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
