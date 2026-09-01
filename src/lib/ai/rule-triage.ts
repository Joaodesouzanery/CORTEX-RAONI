import type { ArticleSnapshot, ReportEvidenceItem } from '@/types'
import { deterministicQualityFlags, inferGeographicScope } from '@/lib/report-quality'
import type { TriageDecision } from '@/lib/ai/triage'

// Keeps the monthly pipeline moving when ANTHROPIC_API_KEY is not configured.
// evaluateClientArticle (src/lib/client-relevance.ts) already sets
// monitoring_status='confirmado' for two cases: a direct client-name mention,
// or enough weighted hits from that client's own relevance rules (score >= 5)
// to be specifically about that client/sector — never a generic/thematic-only
// match. Promoting on monitoring_status alone (not requiring cita_cliente) is
// what "related to the company, not just named" means for this ruleset;
// everything else stays in the annex for manual/AI review later.
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
    const qualifies = snapshot.monitoring_status === 'confirmado'
    if (qualifies) {
      return {
        article_id: item.article_id,
        report_role: 'evidencia',
        editorial_score: 80,
        editorial_reason: snapshot.cita_cliente
          ? 'Classificação automática por regra: menção direta confirmada ao cliente na captação.'
          : 'Classificação automática por regra: relevância específica ao cliente confirmada na captação (sem menção literal do nome).',
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
