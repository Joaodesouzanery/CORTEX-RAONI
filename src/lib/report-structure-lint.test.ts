import { describe, expect, it } from 'vitest'
import { auditReportStructure } from './report-quality'
import type { ReportSection } from '@/types'

const section = (section_key: number, content: string) =>
  ({ section_key, content }) as unknown as ReportSection

const problems = (sections: ReportSection[]) => auditReportStructure(sections)[0]?.details || []

const insights = Array.from({ length: 7 }, (_, i) => `${i + 1}. **Tese ${i + 1}.**\n   Explicação [E00${i + 1}]`)
const SECAO_1 = ['### O NÚMERO DO MÊS', '**R$ 4,2 bilhões** — leilões de agosto [E001]', '### Top Insights do Mês', ...insights].join('\n\n')

const TABELA = [
  '| TEMA ESTRATÉGICO | RELEV. | SINAL DO MÊS |',
  '| --- | --- | --- |',
  ...Array.from({ length: 5 }, (_, i) => `| Tema ${i + 1} | Alta | Consulta aberta em 12/08 [E00${i + 1}] |`),
].join('\n')

const risco = (n: number, p: string, im: string) =>
  `**Risco ${n} — Nome**\nProbabilidade: ${p}\nImpacto: ${im}\nSinal do mês — fato em 12/08 [E001]`
const SECAO_5 = [
  risco(1, 'Alta', 'Muito alto'),
  risco(2, 'Média-alta', 'Alto'),
  risco(3, 'Média', 'Médio'),
  risco(4, 'Alta', 'Alto'),
].join('\n\n')

const SECAO_7 = [
  '### AÇÕES IMEDIATAS (0-15 dias)',
  '- Fazer algo [E001]',
  '### AÇÕES DE CURTO PRAZO (15-60 dias)',
  '- Fazer algo [E001]',
  '### AÇÕES DE MÉDIO PRAZO (2-6 meses)',
  '- Fazer algo [E001]',
].join('\n\n')

const SECAO_8 = [1, 2, 3, 4]
  .map((n) => `**CENÁRIO 0${n} — Nome**\nDescrição [E001]\n**Resposta recomendada:** agir`)
  .join('\n\n')

const COMPLETO = [
  section(1, SECAO_1),
  section(2, TABELA),
  section(5, SECAO_5),
  section(7, SECAO_7),
  section(8, SECAO_8),
]

describe('auditReportStructure', () => {
  it('aprova o relatório no formato ditado pelo prompt', () => {
    expect(problems(COMPLETO)).toEqual([])
    expect(auditReportStructure(COMPLETO)[0]?.status).toBe('passed')
  })

  it('não reclama de seção ainda não gerada', () => {
    // A geração é por grupos: seção 8 ainda vazia não pode bloquear a seção 1.
    expect(problems([section(1, SECAO_1)])).toEqual([])
  })

  it('exige o bloco do número do mês e 7-8 insights em duas partes', () => {
    expect(problems([section(1, SECAO_1.replace('### O NÚMERO DO MÊS', '### Abertura'))]).join(' ')).toMatch(
      /NÚMERO DO MÊS/
    )
    const curto = ['### O NÚMERO DO MÊS', '**10** — algo [E001]', ...insights.slice(0, 4)].join('\n\n')
    expect(problems([section(1, curto)]).join(' ')).toMatch(/4 insights/)
  })

  it('confere a tabela POR LINHA — uma citação numa célula não cobre as outras', () => {
    // Esta é a armadilha: markdownParagraphs trataria a tabela inteira como um
    // parágrafo só, e o [E001] da primeira linha faria as demais passarem.
    const tabela = TABELA.replace('| Tema 5 | Alta | Consulta aberta em 12/08 [E005] |', '| Tema 5 | Alta | Consulta aberta em 12/08 |')
    expect(problems([section(2, tabela)]).join(' ')).toMatch(/sem citação/)
  })

  it('fecha a escada de RELEV. e exige data no sinal', () => {
    expect(problems([section(2, TABELA.replace('| Tema 1 | Alta |', '| Tema 1 | Baixa |'))]).join(' ')).toMatch(
      /fora da escada Alta\/Média/
    )
    expect(problems([section(2, TABELA.replace('Consulta aberta em 12/08 [E001]', 'Consulta aberta [E001]'))]).join(' ')).toMatch(
      /sem data/
    )
  })

  it('bloqueia par probabilidade+impacto repetido e valor fora da escada', () => {
    const repetido = SECAO_5.replace(risco(4, 'Alta', 'Alto'), risco(4, 'Alta', 'Muito alto'))
    expect(problems([section(5, repetido)]).join(' ')).toMatch(/mesmo par/)
    const baixa = SECAO_5.replace('Probabilidade: Média\n', 'Probabilidade: Baixa\n')
    expect(problems([section(5, baixa)]).join(' ')).toMatch(/fora da escada Média/)
  })

  it('exige os três horizontes na ordem e exatamente quatro cenários', () => {
    const doisBlocos = SECAO_7.split('### AÇÕES DE MÉDIO PRAZO')[0] || ''
    expect(problems([section(7, doisBlocos)]).join(' ')).toMatch(/blocos de prazo/)
    const tres = SECAO_8.split('**CENÁRIO 04').slice(0, 1).join('')
    expect(problems([section(8, tres)]).join(' ')).toMatch(/esperado 01, 02, 03, 04/)
  })
})
