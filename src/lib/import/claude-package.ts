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

export function parseClaudePackage(bytes: Uint8Array): ParsedClaudePackage {
  const buffer = Buffer.from(bytes)
  const entries: Array<{ name: string; content: string; size: number }> = []
  let offset = 0
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
    if (safeEntryName(name) && /\.(?:md|csv|json|txt)$/i.test(name) && size <= 10 * 1024 * 1024) {
      const compressed = buffer.subarray(dataStart, dataEnd)
      const raw = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null
      if (raw) entries.push({ name, content: raw.toString('utf8'), size })
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
