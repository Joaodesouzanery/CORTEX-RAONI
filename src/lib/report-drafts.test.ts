import { describe, expect, it } from 'vitest'
import { buildAnnex, buildQualifiedSection, ensureLeadInSection } from './report-drafts'
import type { ReportEvidenceItem } from '@/types'

function evidence(
  bucket: ReportEvidenceItem['bucket'],
  id: string,
  reviewState: 'automatico' | 'pendente' = 'automatico'
): ReportEvidenceItem {
  return {
    id,
    draft_id: 'draft',
    article_id: id,
    bucket,
    position: 1,
    article_snapshot: {
      id,
      title: id === 'lead' ? 'Um gol de placa para o setor elétrico brasileiro' : 'Loteria acumula',
      url: null,
      image_url: null,
      excerpt: null,
      content: 'texto',
      content_status: 'integral',
      author: null,
      published_at: '2026-07-28T12:00:00Z',
      publisher: 'CNN',
      source_name: 'CNN',
      source_categoria: 'imprensa',
    },
    classification_snapshot: {
      relevancia: 'alta',
      tom: 'neutro',
      central_message: 'Sinal factual',
      impact_summary: 'Impacto para o cliente',
      strategic_effect: 'informativo',
      editorial_review_state: reviewState,
    },
    cluster_key: null,
    created_at: '2026-07-29T12:00:00Z',
  }
}

describe('monthly report evidence products', () => {
  it('keeps qualified evidence in section 10 and noise only in the annex', () => {
    const items = [evidence('qualified', 'lead'), evidence('annex', 'noise')]
    expect(buildQualifiedSection(items)).toContain('Um gol de placa')
    expect(buildQualifiedSection(items)).not.toContain('Loteria')
    expect(buildAnnex(items)).toContain('Loteria')
    expect(buildAnnex(items)).not.toContain('Um gol de placa')
  })

  it('separates pending review from confirmed context without omitting either', () => {
    const output = buildAnnex([
      evidence('annex', 'pending', 'pendente'),
      evidence('annex', 'confirmed', 'automatico'),
    ])
    expect(output).toContain('Pendentes de conferência (1)')
    expect(output).toContain('Contexto e ruído monitorados (1)')
    expect(output.match(/Loteria acumula/g)).toHaveLength(2)
  })

  it('forces the manually selected lead into the executive summary and section 4.1', () => {
    const lead = evidence('qualified', 'lead')
    expect(ensureLeadInSection('## 1. SUMÁRIO EXECUTIVO\n\nTexto.', 1, lead)).toContain('Um gol de placa')
    const section4 = ensureLeadInSection('## 4. ANÁLISE TEMÁTICA APROFUNDADA\n\nTexto.', 4, lead)
    expect(section4).toContain('### 4.1.')
    expect(section4).toContain('Um gol de placa')
  })
})
