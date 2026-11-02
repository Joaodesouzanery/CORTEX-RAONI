/** Setores por agência reguladora federal (as 11 da Lei 13.848/2019). */
export const SECTORS = [
  { key: 'energia', label: 'Energia', agencies: ['ANEEL'], color: '#14324f', accent: '#c75f1a' },
  { key: 'petroleo', label: 'Petróleo e gás', agencies: ['ANP'], color: '#1f2428', accent: '#a87a0c' },
  { key: 'agua', label: 'Água', agencies: ['ANA'], color: '#0b4a6f', accent: '#12808d' },
  { key: 'mineracao', label: 'Mineração', agencies: ['ANM'], color: '#3a2a20', accent: '#b0561f' },
  { key: 'transportes', label: 'Portos e transportes', agencies: ['ANTAQ', 'ANTT'], color: '#10355c', accent: '#1b7fb0' },
  { key: 'telecom', label: 'Telecom e TI', agencies: ['ANATEL'], color: '#26215c', accent: '#6a4be0' },
  { key: 'aviacao', label: 'Aviação', agencies: ['ANAC'], color: '#17384a', accent: '#23857e' },
  { key: 'saude', label: 'Saúde', agencies: ['ANVISA', 'ANS'], color: '#0f4a3c', accent: '#1f8a55' },
  { key: 'audiovisual', label: 'Audiovisual', agencies: ['ANCINE'], color: '#4a1538', accent: '#c7346c' },
] as const

export const AGENCIES = SECTORS.flatMap((sector) => sector.agencies as readonly string[])

// clients.sector é texto livre: casa por palavra-chave e cai no primeiro setor neutro.
const SECTOR_HINTS: Array<[RegExp, string]> = [
  [/energ|el[eé]tric/i, 'energia'],
  [/petr[oó]leo|g[aá]s/i, 'petroleo'],
  [/miner/i, 'mineracao'],
  [/port|aquavi|hidrov|transport/i, 'transportes'],
  [/software|tecnolog|\bTI\b|telecom/i, 'telecom'],
]

export function sectorForClient(sector: string | null | undefined) {
  const key = SECTOR_HINTS.find(([pattern]) => pattern.test(sector ?? ''))?.[1]
  return SECTORS.find((item) => item.key === key) ?? SECTORS[0]
}
