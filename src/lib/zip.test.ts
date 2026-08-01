import { describe, expect, it } from 'vitest'
import { createZip } from './zip'

describe('Claude package zip', () => {
  it('writes a standard ZIP archive containing every requested filename', () => {
    const archive = createZip([
      { name: '00_INSTRUCOES.md', content: '# Instruções' },
      { name: '03_ANEXO_MONITORADO.csv', content: 'titulo,veiculo' },
    ])
    expect(archive.readUInt32LE(0)).toBe(0x04034b50)
    expect(archive.includes(Buffer.from('00_INSTRUCOES.md'))).toBe(true)
    expect(archive.includes(Buffer.from('03_ANEXO_MONITORADO.csv'))).toBe(true)
    expect(archive.readUInt32LE(archive.length - 22)).toBe(0x06054b50)
  })
})
