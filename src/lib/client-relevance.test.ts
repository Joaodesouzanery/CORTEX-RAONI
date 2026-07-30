import { describe, expect, it } from 'vitest'
import { evaluateClientArticle, mergeAutomatedEvaluation } from './client-relevance'
import type { Client, ClientRelevanceRule } from '@/types'

const client = (name: string): Client => ({
  id: name,
  name,
  context: null,
  report_prompt: null,
  sector: null,
  contratante: null,
  keywords: null,
  synonyms: null,
  feed_names: null,
  alert_recipient: null,
  logo_url: null,
  active: true,
  created_at: '2026-01-01',
})

const rule = (
  clientId: string,
  label: string,
  matchType: 'direta' | 'setorial',
  requiredGroups: string[][],
  weight: number
): ClientRelevanceRule => ({
  id: label,
  client_id: clientId,
  label,
  match_type: matchType,
  required_groups: requiredGroups,
  excluded_terms: [],
  weight,
  version: 1,
  active: true,
})

describe('contextual client relevance', () => {
  it('classifies the ONS examples as direct technical mentions', () => {
    const ons = client('ONS')
    const rules = [rule('ONS', 'aliases institucionais', 'direta', [['ONS', 'Operador Nacional do Sistema']], 8)]
    const result = evaluateClientArticle(ons, rules, {
      title: 'Temporal derruba 54 torres de transmissão',
      excerpt: 'O restabelecimento foi coordenado pelo ONS.',
      content: null,
    })
    expect(result).toMatchObject({
      cita_cliente: true,
      monitoring_status: 'confirmado',
      relevancia: 'alta',
    })
  })

  it('recovers every known ONS reference topic as a direct technical mention', () => {
    const ons = client('ONS')
    const rules = [
      rule(
        'ONS',
        'aliases institucionais',
        'direta',
        [['ONS', 'Operador Nacional do Sistema Elétrico']],
        8
      ),
    ]
    const references = [
      'O restabelecimento das cargas foi coordenado pelo Operador Nacional do Sistema Elétrico (ONS).',
      'O ONS registrou desligamentos automáticos após a queda de 54 torres.',
      'Com o El Niño, o ONS pediu providências às usinas termelétricas.',
      'EPE e ONS precisam ser ouvidos na expansão do sistema.',
      'O ONS poderá despachar os sistemas de baterias por até 12 horas.',
      'O curtailment ocorre quando o ONS determina a redução da geração.',
      'O ONS encaminhou à Aneel contribuições sobre limitação da geração.',
    ]
    const matches = references.map((excerpt, index) =>
      evaluateClientArticle(ons, rules, {
        title: `Referência ONS ${index + 1}`,
        excerpt,
        content: null,
      })
    )
    expect(matches.filter(Boolean)).toHaveLength(references.length)
    for (const match of matches) {
      expect(match).toMatchObject({
        cita_cliente: true,
        monitoring_status: 'confirmado',
      })
      expect(
        mergeAutomatedEvaluation(null, match!).tom
      ).toBe('neutro')
    }
  })

  it('keeps the known emissions item as low-confidence ONS sector coverage', () => {
    const result = evaluateClientArticle(
      client('ONS'),
      [
        rule(
          'ONS',
          'transição energética e clima',
          'setorial',
          [['verificação de emissões', 'mercado de carbono']],
          2
        ),
      ],
      {
        title: 'Verificação de emissões pode alcançar até 400 empresas',
        excerpt: null,
        content: null,
      }
    )
    expect(result).toMatchObject({
      cita_cliente: false,
      monitoring_status: 'revisao',
      relevancia: 'baixa',
    })
  })

  it('rejects ONS/on and Pará/para collisions', () => {
    const ons = client('ONS')
    const onsRules = [rule('ONS', 'aliases', 'direta', [['ONS']], 8)]
    expect(
      evaluateClientArticle(ons, onsRules, {
        title: 'JPMorgan eleva recomendação',
        excerpt: 'appeared first on InfoMoney',
        content: null,
      })
    ).toBeNull()
    expect(
      evaluateClientArticle(ons, onsRules, {
        title: 'Ibovespa sobe com ações ONs e PNs',
        excerpt: 'Papéis negociados aparecem no radar financeiro.',
        content: null,
      })
    ).toBeNull()

    const simineral = client('SIMINERAL')
    const miningRules = [rule('SIMINERAL', 'mineração', 'setorial', [['mineração']], 3)]
    expect(
      evaluateClientArticle(simineral, miningRules, {
        title: 'Crédito para pequenas empresas',
        excerpt: null,
        content: null,
      })
    ).toBeNull()
    expect(
      evaluateClientArticle(
        simineral,
        miningRules,
        {
          title: 'Programa oferece crédito para municípios do Pará',
          excerpt: null,
          content: null,
        },
        true
      )
    ).toBeNull()
  })

  it('does not include consumer technology from a SINDINFOR thematic source alone', () => {
    expect(
      evaluateClientArticle(
        client('SINDINFOR'),
        [
          rule(
            'SINDINFOR',
            'software nacional',
            'setorial',
            [['indústria de software', 'tributação de software']],
            3
          ),
        ],
        {
          title: 'Novo celular ganha câmera aprimorada e bateria maior',
          excerpt: 'Veja os preços do aparelho para consumidores.',
          content: null,
        },
        true
      )
    ).toBeNull()
  })

  it('requires aquaviary context when DAQ sees DNIT or a thematic source', () => {
    const daq = client('DAQ — Diretoria de Infraestrutura Aquaviária/DNIT')
    const rules = [rule(daq.id, 'DNIT aquaviário', 'setorial', [['DNIT'], ['hidrovia', 'dragagem']], 5)]
    expect(
      evaluateClientArticle(
        daq,
        rules,
        {
          title: 'DNIT anuncia pavimentação de rodovia BR-135',
          excerpt: 'Obra inclui novo viaduto.',
          content: null,
        },
        true
      )
    ).toBeNull()
    expect(
      evaluateClientArticle(daq, rules, {
        title: 'DNIT inicia dragagem de hidrovia',
        excerpt: null,
        content: null,
      })?.monitoring_status
    ).toBe('confirmado')
  })

  it('keeps broad national mining and software coverage', () => {
    const mining = evaluateClientArticle(
      client('SIMINERAL'),
      [rule('SIMINERAL', 'mineração nacional', 'setorial', [['mineração', 'ANM']], 3)],
      { title: 'ANM atualiza regras nacionais de mineração', excerpt: null, content: null }
    )
    const software = evaluateClientArticle(
      client('SINDINFOR'),
      [rule('SINDINFOR', 'software nacional', 'setorial', [['indústria de software', 'Lei do Bem']], 3)],
      { title: 'Lei do Bem muda incentivos para a indústria de software', excerpt: null, content: null }
    )
    expect(mining?.monitoring_status).toBe('candidato')
    expect(software?.monitoring_status).toBe('candidato')
  })

  it('rejects SIMINERAL crypto, market-only and fake document records', () => {
    const rules = [rule('SIMINERAL', 'mineração ampla', 'setorial', [['mineração', 'mineral']], 3)]
    const simineral = client('SIMINERAL')
    expect(
      evaluateClientArticle(simineral, rules, {
        title: 'PM encontra central de mineração de criptomoedas',
        excerpt: 'Equipamentos mineravam bitcoin.',
        content: null,
      })
    ).toBeNull()
    expect(
      evaluateClientArticle(simineral, rules, {
        title: 'Vale (VALE3) sobe no Ibovespa',
        excerpt: 'Ações e dividendos estão no radar.',
        content: null,
      })
    ).toBeNull()
    expect(
      evaluateClientArticle(simineral, rules, {
        title: 'PORTIFÓLIO GRANBEL FINAL 17.cdr',
        excerpt: 'SIMINERAL',
        content: null,
      })
    ).toBeNull()
  })

  it('preserves a human decision during automated reprocessing', () => {
    const evaluation = evaluateClientArticle(
      client('ONS'),
      [rule('ONS', 'aliases', 'direta', [['ONS']], 8)],
      {
        title: 'ONS publica nota técnica',
        excerpt: null,
        content: null,
      }
    )
    expect(evaluation).not.toBeNull()
    const merged = mergeAutomatedEvaluation(
      {
        article_id: 'article',
        client_id: 'ONS',
        tom: 'critico',
        relevancia: 'baixa',
        cita_cliente: true,
        tema: 'decisão editorial',
        classification_source: 'humano',
        monitoring_status: 'excluido',
      },
      evaluation!
    )
    expect(merged).toMatchObject({
      tom: 'critico',
      relevancia: 'baixa',
      tema: 'decisão editorial',
      monitoring_status: 'excluido',
      classification_source: 'humano',
    })
  })
})
