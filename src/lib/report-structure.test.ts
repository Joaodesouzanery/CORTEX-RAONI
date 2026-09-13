import { describe, expect, it } from 'vitest'
import { buildReportStructure } from './report-structure'
import type { ReportSection } from '@/types'

const section = (section_key: number, content: string) => ({ section_key, content }) as unknown as ReportSection

const S1 = `### O NÚMERO DO MÊS

**R$ 4,2 bilhões** — valor dos contratos de arrendamento leiloados em agosto [E012]

### Top Insights do Mês

1. **A agenda de outorgas acelerou.**
   Três leilões foram publicados no mês, contra um em julho [E003].

2. **O tema ambiental voltou ao centro.**
   O licenciamento da dragagem virou pauta em dois veículos nacionais [E007].`

const S2 = `| TEMA ESTRATÉGICO | RELEV. | SINAL DO MÊS |
| --- | --- | --- |
| Outorgas portuárias | Alta | Edital publicado em 12/08 [E001] |
| Hidrovias | Média | Audiência em 20/08 [E004] |`

const S5 = `**Risco 1 — Judicialização do leilão**
Probabilidade: Alta
Impacto: Muito alto
Sinal do mês — liminar concedida em 18/08 [E009]
A disputa tende a se estender ao próximo trimestre.

**Risco 2 — Ruído ambiental**
Probabilidade: Média
Impacto: Alto
Sinal do mês — parecer técnico questionado em 22/08 [E011]
O tema tem tração em veículos nacionais.`

const S7 = `### AÇÕES IMEDIATAS (0-15 dias)

- Preparar nota técnica sobre o edital [E001]
- Alinhar porta-voz com a diretoria [E003]

### AÇÕES DE CURTO PRAZO (15-60 dias)

- Mapear interlocutores no Congresso [E004]

### AÇÕES DE MÉDIO PRAZO (2-6 meses)

- Estruturar relatório de transparência [E007]`

const S8 = `**CENÁRIO 01 — Leilão confirmado**
O edital segue sem suspensão e o certame ocorre no prazo [E001].
**Resposta recomendada:** preparar comunicação de resultado

**CENÁRIO 02 — Suspensão judicial**
A liminar é mantida e o certame é adiado [E009].
**Resposta recomendada:** ativar plano de contingência`

const structure = () =>
  buildReportStructure({ sections: [section(1, S1), section(2, S2), section(5, S5), section(7, S7), section(8, S8)] })

describe('buildReportStructure', () => {
  it('extrai o número do mês separando valor e explicação', () => {
    expect(structure().numero_do_mes).toEqual({
      valor: 'R$ 4,2 bilhões',
      explicacao: 'valor dos contratos de arrendamento leiloados em agosto [E012]',
    })
  })

  it('extrai insights em duas partes', () => {
    const insights = structure().insights
    expect(insights).toHaveLength(2)
    expect(insights[0]).toEqual({
      tese: 'A agenda de outorgas acelerou.',
      explicacao: 'Três leilões foram publicados no mês, contra um em julho [E003].',
    })
  })

  it('extrai a tabela de temas sem o cabeçalho', () => {
    expect(structure().temas).toEqual([
      { tema: 'Outorgas portuárias', relevancia: 'Alta', sinal: 'Edital publicado em 12/08 [E001]' },
      { tema: 'Hidrovias', relevancia: 'Média', sinal: 'Audiência em 20/08 [E004]' },
    ])
  })

  it('extrai probabilidade e impacto — o par que plota a matriz de risco', () => {
    const riscos = structure().riscos
    expect(riscos).toHaveLength(2)
    expect(riscos[0]).toEqual({
      nome: 'Judicialização do leilão',
      probabilidade: 'Alta',
      impacto: 'Muito alto',
      sinal: 'liminar concedida em 18/08 [E009]',
      leitura: 'A disputa tende a se estender ao próximo trimestre.',
    })
  })

  it('agrupa recomendações pelos três horizontes, sempre nas três chaves', () => {
    const rec = structure().recomendacoes
    expect(rec.map((item) => item.horizonte)).toEqual(['imediatas', 'curto_prazo', 'medio_prazo'])
    expect(rec[0].acoes).toHaveLength(2)
    expect(rec[2].acoes[0]).toBe('Estruturar relatório de transparência [E007]')
  })

  it('extrai cenários com número, descrição e resposta', () => {
    const cenarios = structure().cenarios
    expect(cenarios.map((item) => item.numero)).toEqual(['01', '02'])
    expect(cenarios[1].resposta).toBe('ativar plano de contingência')
  })

  it('devolve campos vazios — nunca inventados — quando a seção não foi gerada', () => {
    const parcial = buildReportStructure({ sections: [section(1, S1)] })
    expect(parcial.riscos).toEqual([])
    expect(parcial.cenarios).toEqual([])
    // Os horizontes continuam presentes com lista vazia: o design lê a forma,
    // não precisa lidar com chave ausente.
    expect(parcial.recomendacoes.map((item) => item.acoes)).toEqual([[], [], []])
  })
})
