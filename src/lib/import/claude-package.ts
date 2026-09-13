import { inflateRawSync } from 'node:zlib'

export interface ParsedClaudePackage {
  extractedText: string
  files: Array<{ name: string; size: number }>
  checklist: {
    passed: string[]
    pending: string[]
  }
  metadata: Record<string, unknown>
}

function safeEntryName(name: string) {
  return !name.includes('..') && !name.startsWith('/') && !name.includes('\\')
}

/** Teto por entrada e para o pacote inteiro, imposto pelo descompressor. */
const MAX_ENTRY_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 40 * 1024 * 1024

export function parseClaudePackage(bytes: Uint8Array): ParsedClaudePackage {
  const buffer = Buffer.from(bytes)
  const entries: Array<{ name: string; content: string; size: number }> = []
  let offset = 0
  let inflatedTotal = 0
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6)
    const method = buffer.readUInt16LE(offset + 8)
    const compressedSize = buffer.readUInt32LE(offset + 18)
    const size = buffer.readUInt32LE(offset + 22)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const extraLength = buffer.readUInt16LE(offset + 28)
    if (flags & 0x0008) throw new Error('Pacotes ZIP com descritor de dados não são suportados.')
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > buffer.length) throw new Error('Pacote ZIP truncado.')
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8')
    if (safeEntryName(name) && /\.(?:md|csv|json|txt)$/i.test(name) && size <= MAX_ENTRY_BYTES) {
      const compressed = buffer.subarray(dataStart, dataEnd)
      // `size` vem do cabeçalho local do ZIP — é declarado por quem montou o
      // arquivo, não medido. Um pacote pode dizer `size: 1` e trazer 1 MB que
      // infla para 10 GB. Por isso o teto vai para o zlib, que aborta durante a
      // descompressão, em vez de confiar no número declarado.
      let raw: Buffer | null = null
      if (method === 0) {
        raw = Buffer.from(compressed)
      } else if (method === 8) {
        try {
          raw = inflateRawSync(compressed, {
            maxOutputLength: Math.min(MAX_ENTRY_BYTES, MAX_TOTAL_BYTES - inflatedTotal),
          })
        } catch {
          // Entrada acima do teto ou corrompida: pula, não derruba o pacote.
          raw = null
        }
      }
      if (raw) {
        inflatedTotal += raw.length
        if (inflatedTotal > MAX_TOTAL_BYTES) {
          throw new Error('Pacote ZIP excede o tamanho máximo descomprimido permitido.')
        }
        entries.push({ name, content: raw.toString('utf8'), size: raw.length })
      }
    }
    offset = dataEnd
  }
  if (!entries.length) throw new Error('O ZIP não contém arquivos textuais reconhecíveis do pacote Claude.')
  const instructions = entries.find((entry) => /^00_.*\.md$/i.test(entry.name))?.content || ''
  const checklistLines = instructions.split('\n').filter((line) => /^- \[[ x]\]/i.test(line.trim()))
  const passed = checklistLines.filter((line) => /^- \[x\]/i.test(line.trim())).map((line) => line.replace(/^- \[x\]\s*/i, '').trim())
  const pending = checklistLines.filter((line) => /^- \[ \]/.test(line.trim())).map((line) => line.replace(/^- \[ \]\s*/, '').trim())
  const draft = entries.find((entry) => /^01_.*\.md$/i.test(entry.name))?.content || ''
  const evidence = entries.find((entry) => /^02_.*\.md$/i.test(entry.name))?.content || ''
  const annex = entries.find((entry) => /^03_.*\.csv$/i.test(entry.name))?.content || ''
  const monitored = Number(draft.match(/\*\*(\d+)\s+ocorr[eê]ncias monitoradas/i)?.[1] || 0)
  const qualified = Number(draft.match(/\*\*(\d+)\*?\*?\s+comp[oõ]em a Base Qualificada/i)?.[1] || 0)
  return {
    extractedText: entries.map((entry) => `# ${entry.name}\n\n${entry.content}`).join('\n\n---\n\n'),
    files: entries.map(({ name, size }) => ({ name, size })),
    checklist: { passed, pending },
    metadata: {
      artifact_kind: 'diagnostic_package',
      monitored,
      qualified,
      evidence_empty: /nenhuma evid[eê]ncia qualificada/i.test(evidence),
      annex_rows: Math.max(0, annex.split('\n').filter(Boolean).length - 1),
      checklist_ready: pending.length === 0,
    },
  }
}
