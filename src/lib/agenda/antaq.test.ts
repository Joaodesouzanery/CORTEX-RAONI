import { describe, expect, it } from 'vitest'
import { latestBulletinUrl, parseAntaqBulletin } from './antaq'

const block = (key: string, title: string, status: string, phase: string, note = '') =>
  `${key}. ${title}\nO objetivo é revisar.\nStatus: ${status}\nProcesso: 1\nMacroetapa: ${phase}\nObservação: ${note}`

describe('parseAntaqBulletin', () => {
  it('lê tema, fase e prazo oficial e ignora a lista sem detalhe', () => {
    const text = `1.3. Barge to ship\n2025\n${block('1.3', 'Barge to ship', 'Em andamento', '3. Em Tomada', 'pelo período de 16/09/2026 a 15/10/2026.')}`
    expect(parseAntaqBulletin(text)).toEqual([
      { key: '1.3', title: '1.3 Barge to ship', phase: '3. Em Tomada', deadline: '2026-10-15' },
    ])
  })

  it('não traz tema excluído pela agência e não inventa prazo', () => {
    const text = `${block('1.5', 'Esquema', 'Excluído por meio do Acórdão', '-')}\n${block('2.4', 'Outorgas', 'Aguardando início', '1. Não iniciado', '-')}`
    expect(parseAntaqBulletin(text)).toEqual([{ key: '2.4', title: '2.4 Outorgas', phase: '1. Não iniciado', deadline: null }])
  })

  it('usa a primeira parte de tema dividido', () => {
    const text = `${block('2.1', 'Afretamento', 'Em andamento', '5. Deliberação')}`
    expect(parseAntaqBulletin(text)[0].phase).toBe('5. Deliberação')
  })
})

describe('latestBulletinUrl', () => {
  it('pega o primeiro boletim listado, ignorando outros PDFs', () => {
    const html = '<a href="https://x/AR.pdf">a</a><a href="https://x/21-boletim-set.pdf">b</a><a href="https://x/20-boletim-ago.pdf">c</a>'
    expect(latestBulletinUrl(html)).toBe('https://x/21-boletim-set.pdf')
  })
})
