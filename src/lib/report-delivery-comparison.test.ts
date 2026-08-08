import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { compareDeliveredReport } from './report-delivery-comparison'
import { parseClaudePackage } from './import/claude-package'
import { parsePdf } from './import/pdf-parser'

describe('delivered report comparison', () => {
  it('detects a regulatory theme added after the CORTEX package', () => {
    const result = compareDeliveredReport({
      referenceTitle: 'SINDINFOR julho 2026',
      deliveredText:
        'REGULAÇÃO DE PLATAFORMAS\nA vigência do Decreto 12.975 alterou o Marco Civil da Internet. A ADI chegou ao STF.',
      generatedText: '## 1. SUMÁRIO\nSoftware e economia digital.\n## 10. BASE QUALIFICADA\nNenhuma evidência qualificada.',
      leadTitle: null,
      packageBaseVersion: 3,
    })
    expect(result.added_topics.join(' ')).toMatch(/Decreto 12\.975|marco civil da internet/i)
    expect(result.factual_claims_without_base.join(' ')).toMatch(/Decreto 12\.975/i)
    expect(result.package_base_version).toBe(3)
  })

  it('reports unresolved placeholders in a delivered report', () => {
    const result = compareDeliveredReport({
      referenceTitle: 'CCEE julho 2026',
      deliveredText: 'Reuniões presenciais | [A PREENCHER]',
      generatedText: '',
    })
    expect(result.remaining_placeholders).toEqual(['[A PREENCHER]'])
  })
})

const sindinforPackage = '/Users/joaonery/Downloads/SINDINFOR-2026-07-pacote-claude-v3.zip'
const sindinforReport = '/Users/joaonery/Downloads/SINDIFOR Relatório Julho 2026.pdf'
describe.skipIf(!existsSync(sindinforPackage) || !existsSync(sindinforReport))(
  'SINDINFOR delivered-report regression',
  () => {
    it('finds regulatory material added after the empty CORTEX package', async () => {
      const diagnostic = parseClaudePackage(new Uint8Array(readFileSync(sindinforPackage)))
      const delivered = await parsePdf(
        new Uint8Array(readFileSync(sindinforReport)),
        'SINDIFOR Relatório Julho 2026.pdf'
      )
      const comparison = compareDeliveredReport({
        referenceTitle: 'SINDINFOR julho 2026',
        deliveredText: delivered.referenceText || '',
        generatedText: diagnostic.extractedText,
        packageBaseVersion: 3,
      })
      expect(comparison.added_topics.join(' ')).toMatch(/vacatio|stf|plataform/i)
    }, 30000)
  }
)
