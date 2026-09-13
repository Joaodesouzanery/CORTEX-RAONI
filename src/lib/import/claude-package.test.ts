import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
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

describe('resistência a bomba de descompressão', () => {
  /**
   * Monta um ZIP de uma entrada só, com o cabeçalho local forjado: o campo de
   * tamanho descomprimido é DECLARADO por quem monta o arquivo, não medido.
   * Era exatamente nele que o parser confiava antes de passar o teto ao zlib.
   */
  function forgedZip(name: string, payload: Buffer, declaredSize: number) {
    const compressed = deflateRawSync(payload)
    const nameBytes = Buffer.from(name, 'utf8')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4) // version
    header.writeUInt16LE(0, 6) // flags — sem descritor de dados
    header.writeUInt16LE(8, 8) // método deflate
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(declaredSize, 22) // <- o número mentiroso
    header.writeUInt16LE(nameBytes.length, 26)
    header.writeUInt16LE(0, 28)
    return Buffer.concat([header, nameBytes, compressed])
  }

  it('não estoura a memória com um size declarado como 1', () => {
    // 64 MB de zeros comprimem para poucos KB. Declarado como 1 byte, passava
    // pelo `size <= 10MB` e ia inteiro para o inflateRawSync sem teto.
    const bomb = forgedZip('00_INSTRUCOES.md', Buffer.alloc(64 * 1024 * 1024, 0x41), 1)
    expect(bomb.length).toBeLessThan(200 * 1024) // o arquivo em si é pequeno
    // A entrada é descartada pelo teto do zlib, então o pacote fica sem
    // arquivos textuais reconhecíveis e falha de forma limpa.
    expect(() => parseClaudePackage(new Uint8Array(bomb))).toThrow(
      /não contém arquivos textuais/i
    )
  })

  it('continua lendo um pacote legítimo comprimido', () => {
    const ok = forgedZip('00_INSTRUCOES.md', Buffer.from('- [x] Base atualizada\n', 'utf8'), 22)
    const parsed = parseClaudePackage(new Uint8Array(ok))
    expect(parsed.checklist.passed).toEqual(['Base atualizada'])
  })
})
