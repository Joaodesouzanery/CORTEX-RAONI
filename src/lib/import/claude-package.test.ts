import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createZip } from '@/lib/zip'
import { parseClaudePackage } from './claude-package'

describe('Claude package import', () => {
  it('preserves an incomplete package as a diagnostic artifact', () => {
    const archive = createZip([
      {
        name: '00_INSTRUCOES.md',
        content: '- [x] Base atualizada\n- [ ] Triagem completa — 125 itens\n- [ ] Matéria principal escolhida',
      },
      {
        name: '01_RASCUNHO_RELATORIO.md',
        content: 'O universo reúne **125 ocorrências monitoradas**. **0** compõem a Base Qualificada.',
      },
      { name: '02_EVIDENCIAS_QUALIFICADAS.md', content: 'Nenhuma evidência qualificada.' },
      { name: '03_ANEXO_MONITORADO.csv', content: 'titulo\nA\nB' },
    ])
    const parsed = parseClaudePackage(new Uint8Array(archive))
    expect(parsed.checklist.pending).toHaveLength(2)
    expect(parsed.metadata).toMatchObject({
      artifact_kind: 'diagnostic_package',
      monitored: 125,
      qualified: 0,
      evidence_empty: true,
      checklist_ready: false,
    })
  })
})

const realPackage = '/Users/joaonery/Downloads/SINDINFOR-2026-07-pacote-claude-v3.zip'
describe.skipIf(!existsSync(realPackage))('SINDINFOR July diagnostic package regression', () => {
  it('recognizes the incomplete handoff that must not become a final package', () => {
    const parsed = parseClaudePackage(new Uint8Array(readFileSync(realPackage)))
    expect(parsed.metadata).toMatchObject({
      monitored: 125,
      qualified: 0,
      evidence_empty: true,
      checklist_ready: false,
    })
    expect(parsed.checklist.pending.length).toBeGreaterThanOrEqual(5)
  })
})
