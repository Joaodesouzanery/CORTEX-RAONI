import { describe, expect, it } from 'vitest'
import { buildQualificationPackage, importSchema, validateDecisions, type QualificationItem } from './qualification'

const items: QualificationItem[] = [
  { id: 'a1', title: 'ONS eleva previsão de carga | teste [x]', excerpt: 'Resumo curto', publisher: 'CNN', date: '2026-10-16T12:00:00Z', url: 'https://www.cnnbrasil.com.br/infra/ons-carga/', link_status: 'exato', status: 'revisao', source: 'regra', tema: null, cita_cliente: true },
  { id: 'a2', title: 'Leilão de baterias', excerpt: null, publisher: 'Google News', date: '2026-10-20T12:00:00Z', url: 'https://news.google.com/rss/articles/x', link_status: 'google_news', status: 'candidato', source: 'regra', tema: 'Baterias', cita_cliente: false },
]
const client = { name: 'ONS', sector: 'setor elétrico', report_prompt: 'Foco em operação do SIN.', themes: ['Baterias', 'Carga de energia'] }

describe('pacote de qualificação para outro chat', () => {
  const md = buildQualificationPackage(client, '2026-10', items)

  it('leva o prompt mestre, os temas, o formato de resposta e as matérias como dado', () => {
    expect(md).toContain('Foco em operação do SIN.')
    expect(md).toContain('- Carga de energia')
    expect(md).toContain('"decisoes"')
    expect(md).toContain('<materias>')
    expect(md).toContain('"id":"a1"')
  })

  it('link do Google News não vai como link exato na tabela; título não quebra a tabela', () => {
    expect(md).toContain('(google_news)')
    expect(md).toContain('ONS eleva previsão de carga / teste x')
  })

  it('a resposta colada passa pelo schema e só aceita id do pacote e tema da lista', () => {
    const parsed = importSchema.parse({
      decisoes: [
        { article_id: 'a1', relevante: true, cita_cliente: true, tema: 'Carga de energia', tom: 'neutro', motivo: 'ok' },
        { article_id: 'zzz', relevante: true, cita_cliente: true, tema: 'Carga de energia', tom: 'neutro', motivo: 'forjado' },
        { article_id: 'a2', relevante: false, cita_cliente: false, tema: 'Inventado', tom: 'neutro', motivo: 'x' },
      ],
    })
    const valid = validateDecisions(parsed.decisoes, items, client.themes)
    expect(valid.map((d) => d.article_id)).toEqual(['a1', 'a2'])
    expect(valid[1].tema).toBeNull()
  })
})
