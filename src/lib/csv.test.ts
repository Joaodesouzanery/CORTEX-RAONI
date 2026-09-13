import { describe, expect, it } from 'vitest'
import { csvCell } from './csv'

describe('csvCell', () => {
  it('neutraliza fórmula vinda de título de terceiro', () => {
    // O conteúdo do CSV vem de matéria de terceiro. Uma planilha executa
    // qualquer célula que comece com = + - @ ao abrir o arquivo.
    expect(csvCell('=HYPERLINK("http://evil","clique")')).toBe(
      '"\'=HYPERLINK(""http://evil"",""clique"")"'
    )
    expect(csvCell("=cmd|'/c calc'!A0")).toBe('"\'=cmd|\'/c calc\'!A0"')
    expect(csvCell('+1+1')).toBe('"\'+1+1"')
    expect(csvCell('-2+3')).toBe('"\'-2+3"')
    expect(csvCell('@SUM(A1:A9)')).toBe('"\'@SUM(A1:A9)"')
  })

  it('não mexe em texto comum e segue escapando aspas', () => {
    expect(csvCell('Antaq aprova arrendamento')).toBe('"Antaq aprova arrendamento"')
    expect(csvCell('Diretor disse "não haverá atraso"')).toBe('"Diretor disse ""não haverá atraso"""')
    expect(csvCell(null)).toBe('""')
    expect(csvCell(undefined)).toBe('""')
    expect(csvCell(42)).toBe('"42"')
  })
})
