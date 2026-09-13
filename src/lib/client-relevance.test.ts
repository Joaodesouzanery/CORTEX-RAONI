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
        manual_intake: true,
        manual_received_at: '2026-07-29T18:59:03.000Z',
      },
      evaluation!
    )
    expect(merged).toMatchObject({
      tom: 'critico',
      relevancia: 'baixa',
      tema: 'decisão editorial',
      monitoring_status: 'excluido',
      classification_source: 'humano',
      manual_intake: true,
      manual_received_at: '2026-07-29T18:59:03.000Z',
    })
  })
})

// ---------------------------------------------------------------------------
// ANTAQ × DAQ
//
// As regras da ANTAQ abaixo são a fixture espelhada da migration 034. As do DAQ
// vêm da 025 e estão CONGELADAS: cada asserção sobre o DAQ é uma asserção de
// não-regressão — o veredicto tem de ser idêntico antes e depois da ANTAQ
// existir. É isto que prova, de forma barata e determinística, que a ANTAQ não
// canibaliza o DAQ.
// ---------------------------------------------------------------------------

const ruleWithExclusions = (
  clientId: string,
  label: string,
  matchType: 'direta' | 'setorial',
  requiredGroups: string[][],
  excludedTerms: string[],
  weight: number
): ClientRelevanceRule => ({
  id: `${clientId}:${label}`,
  client_id: clientId,
  label,
  match_type: matchType,
  required_groups: requiredGroups,
  excluded_terms: excludedTerms,
  weight,
  version: 1,
  active: true,
})

const DAQ_NAME = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT'

const DAQ_RULES: ClientRelevanceRule[] = [
  ruleWithExclusions(DAQ_NAME, 'aliases institucionais', 'direta',
    [['DAQ', 'Diretoria de Infraestrutura Aquaviária']], [], 8),
  ruleWithExclusions(DAQ_NAME, 'infraestrutura aquaviária', 'setorial',
    [['hidrovia', 'hidrovias', 'dragagem', 'desassoreamento', 'eclusa', 'navegação interior',
      'transporte aquaviário', 'porto fluvial', 'canal de navegação', 'sinalização náutica']], [], 4),
  ruleWithExclusions(DAQ_NAME, 'DNIT em contexto aquaviário', 'setorial',
    [['DNIT'], ['hidrovia', 'dragagem', 'eclusa', 'navegação', 'aquaviário', 'porto fluvial']],
    ['rodovia', 'pavimentação', 'viaduto', 'BR-'], 5),
]

const ANTAQ_RULES: ClientRelevanceRule[] = [
  ruleWithExclusions('ANTAQ', 'menção direta à ANTAQ', 'direta',
    [['ANTAQ', 'Agência Nacional de Transportes Aquaviários']], [], 8),
  ruleWithExclusions('ANTAQ', 'outorgas, arrendamentos e leilões portuários', 'setorial', [
    ['outorga', 'outorgas', 'arrendamento', 'arrendamentos', 'leilão', 'leilões', 'concessão',
     'concessões', 'licitação', 'edital', 'chamada pública', 'desestatização', 'relicitação',
     'prorrogação antecipada', 'PAR05'],
    ['porto organizado', 'portos organizados', 'autoridade portuária', 'instalação portuária',
     'instalações portuárias', 'terminal portuário', 'terminais portuários',
     'terminal de uso privado', 'terminais de uso privado', 'TUP', 'arrendatária',
     'setor portuário', 'Porto de Santos', 'Porto de Paranaguá', 'Porto de Itajaí',
     'Porto de São Sebastião', 'Porto do Rio Grande', 'Porto de Suape', 'Porto do Itaqui',
     'Porto de Pecém'],
  ], [], 4),
  ruleWithExclusions('ANTAQ', 'atos regulatórios e tarifários do setor aquaviário', 'setorial', [
    ['resolução normativa', 'norma regulatória', 'agenda regulatória', 'tomada de subsídios',
     'consulta pública', 'audiência pública', 'análise de impacto regulatório',
     'sandbox regulatório', 'regras tarifárias', 'tarifa portuária', 'tarifas portuárias',
     'revisão tarifária', 'marco regulatório', 'serviço adequado', 'auto de infração'],
    ['portuário', 'portuária', 'aquaviário', 'aquaviária', 'cabotagem', 'navegação interior',
     'porto organizado', 'autoridade portuária', 'terminal de uso privado', 'praticagem',
     'afretamento', 'marinha mercante', 'apoio marítimo', 'transporte aquaviário'],
  ], ['cabotagem aérea', 'aeronautas'], 4),
  ruleWithExclusions('ANTAQ', 'cabotagem, navegação e marinha mercante', 'setorial', [
    ['cabotagem', 'BR do Mar', 'navegação de cabotagem', 'navegação de longo curso',
     'marinha mercante', 'empresa brasileira de navegação', 'empresas brasileiras de navegação',
     'afretamento', 'apoio marítimo', 'apoio portuário', 'navegação de travessia',
     'navegação lacustre'],
  ], ['cabotagem aérea', 'aeronautas', 'cabotagem aeroviária'], 3),
  ruleWithExclusions('ANTAQ', 'hidrovias e navegação interior sob ótica regulatória', 'setorial', [
    ['hidrovia', 'hidrovias', 'hidroviário', 'hidroviária', 'navegação interior',
     'navegação fluvial', 'via navegável', 'vias navegáveis', 'transporte hidroviário',
     'Hidrovia do Madeira', 'Hidrovia do Tapajós', 'Tocantins-Araguaia', 'Paraguai-Paraná',
     'Tietê-Paraná', 'Lagoa Mirim', 'Hidrovia Verde', 'Sul-Mirim', 'SAIP', 'canal de acesso'],
    ['outorga', 'outorgas', 'concessão', 'concessões', 'autorização', 'permissão', 'tarifa',
     'pedágio hidroviário', 'consulta pública', 'audiência pública', 'agenda regulatória',
     'marco regulatório', 'Plano Geral de Outorgas', 'estudo de viabilidade', 'EVTEA',
     'leilão', 'edital', 'modelagem', 'PNL 2050'],
  ], [], 3),
  ruleWithExclusions('ANTAQ', 'portos, terminais e movimentação de cargas', 'setorial', [
    ['porto organizado', 'portos organizados', 'autoridade portuária', 'setor portuário',
     'instalação portuária', 'instalações portuárias', 'terminal de uso privado',
     'terminais de uso privado', 'estação de transbordo de carga',
     'estações de transbordo de carga', 'instalação portuária pública de pequeno porte',
     'movimentação portuária', 'estatísticas aquaviárias', 'sobreestadia', 'demurrage',
     'praticagem', 'terminal de contêineres', 'terminais de contêineres',
     'instalação portuária de turismo', 'calado operacional', 'profundidade do canal'],
  ], [], 2),
]

const antaqOf = (title: string, content: string | null = null) =>
  evaluateClientArticle(client('ANTAQ'), ANTAQ_RULES, { title, excerpt: null, content })
const daqOf = (title: string, content: string | null = null) =>
  evaluateClientArticle(client(DAQ_NAME), DAQ_RULES, { title, excerpt: null, content })

describe('ANTAQ × DAQ', () => {
  it('confirma menção direta, inclusive na grafia "Antaq" do gov.br', () => {
    // ANTAQ tem 5 letras: classifyKeyword só marca sigla com <= 4, então é
    // `word` e casa case-insensitive. Se fosse sigla, a guarda case-sensitive
    // perderia a maioria das matérias, que escrevem "Antaq".
    expect(antaqOf('Antaq promete ficar de olho em abusos na taxa de seca na Amazônia'))
      .toMatchObject({ monitoring_status: 'confirmado', cita_cliente: true })
    expect(antaqOf('ANTAQ moderniza regulação da navegação interior'))
      .toMatchObject({ monitoring_status: 'confirmado' })
  })

  it('não confunde cabotagem aérea com cabotagem aquaviária', () => {
    expect(antaqOf('Aeronautas alertam para riscos da desregulação da cabotagem aérea')).toBeNull()
    expect(antaqOf('Consulta pública discute cabotagem e apoio marítimo'))
      .toMatchObject({ monitoring_status: 'confirmado' }) // R3 (4) + R4 (3) = 7
  })

  it('não casa topônimos que contêm "porto"', () => {
    // O rascunho anterior punha `porto` cru num grupo OR. O matcher é por
    // token, então "Porto Velho" casava — e com `arrendamento`, que é palavra
    // corriqueira no campo, virava candidato.
    expect(antaqOf('Prefeitura de Porto Velho publica edital de arrendamento de área')).toBeNull()
    expect(antaqOf('Porto Alegre recebe investimento em mobilidade urbana')).toBeNull()
    expect(antaqOf('Festival em Porto Seguro movimenta a economia local')).toBeNull()
  })

  it('captura a pauta de 2026 que a exclusão de "aeroporto" teria matado', () => {
    // O ministério supervisor chama-se Ministério de Portos e AEROPORTOS.
    // Excluir `aeroporto` anulava exatamente o núcleo noticioso do cliente.
    expect(antaqOf('Ministério de Portos e Aeroportos anuncia leilão do Porto de São Sebastião'))
      .toMatchObject({ monitoring_status: 'candidato' })
    expect(antaqOf('Antaq promove ajustes no edital de arrendamento no Porto de Santana'))
      .toMatchObject({ monitoring_status: 'confirmado' })
  })

  it('separa obra física (DAQ) de ato regulatório (ANTAQ) sem usar veto', () => {
    const obra = 'DNIT conclui dragagem de manutenção na hidrovia do Madeira'
    expect(antaqOf(obra)).toBeNull()
    expect(daqOf(obra)).toMatchObject({ monitoring_status: 'confirmado' })

    const leilao = 'Governo publica edital da concessão da hidrovia do Tocantins; DNIT executará derrocamento'
    // A regra da ANTAQ NÃO exclui dragagem/derrocamento — é o AND com
    // vocabulário regulatório que faz a separação. Excluí-los mataria a regra
    // justamente nos leilões de concessão, que descrevem obra no escopo.
    expect(antaqOf(leilao)).toMatchObject({ monitoring_status: 'candidato' })
    expect(daqOf(leilao)).toMatchObject({ monitoring_status: 'confirmado' })
  })

  it('não é arrastada pela abreviação "etc" em manchete caixa-alta', () => {
    // `ETC` (estação de transbordo de carga) é sigla de 3 letras: a guarda
    // reduz-se a "o documento contém ETC maiúsculo". Por isso está banida do
    // vocabulário — a competência entra pela frase por extenso.
    expect(antaqOf('PORTOS, HIDROVIAS, FERROVIAS ETC: O QUE MUDA EM 2026')).toBeNull()
  })

  it('cobre a competência de transbordo pela frase, não pela sigla', () => {
    expect(antaqOf('Antaq autoriza nova estação de transbordo de carga no rio Tapajós'))
      .toMatchObject({ monitoring_status: 'confirmado' })
  })

  it('mantém os veredictos do DAQ inalterados (não-regressão)', () => {
    expect(daqOf('Temporal atinge rodovia BR-163 e interdita pavimentação')).toBeNull()
    expect(daqOf('DAQ apresenta plano para eclusas do Tietê'))
      .toMatchObject({ monitoring_status: 'confirmado', cita_cliente: true })
    expect(daqOf('Obras de desassoreamento avançam no canal de navegação'))
      .toMatchObject({ monitoring_status: 'candidato' })
  })

  it('a rede de segurança setorial fica em revisão, fora do relatório', () => {
    // R6 tem peso 2 de propósito: sozinha rende `revisao`/baixa, aparece na
    // fila de curadoria e não entra na base qualificada.
    expect(antaqOf('Movimentação portuária cresce no primeiro semestre'))
      .toMatchObject({ monitoring_status: 'revisao', relevancia: 'baixa' })
  })
})
