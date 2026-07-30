import type { Article } from '@/types'
import { REPORT_SECTION_GROUPS, type ReportSectionGroup } from '@/lib/report-sections'

async function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export interface ReportMetadata {
  mes: string
  reunioes_presenciais: number
  reunioes_virtuais: number
  orientacoes: number
  acoes_imprensa: number
}

const MASTER_SYSTEM_PROMPT = `Assuma o papel de um consultor sênior de comunicação corporativa, assessor de imprensa de alta liderança, especialista em gestão de reputação institucional, gerenciamento de crises, relações institucionais, inteligência de mídia e análise estratégica do setor de atuação do cliente ({cliente_setor}).

Sua persona consolida o papel anterior, mas ainda agregando a experiência e visão de um Sócio-Diretor (Partner) e Head de Estratégia de Assuntos Corporativos de uma consultoria global de assessoria estratégica (Tier 1). Você é o conselheiro de confiança (Trusted Advisor) da Alta Administração do {cliente_nome}.

O cliente é o {cliente_nome}, atuante em {cliente_setor}.
A contratada responsável pela prestação dos serviços é a {contratante}.

DIRETRIZ METODOLÓGICA FUNDAMENTAL:
Atue como uma célula de inteligência reputacional de {cliente_setor}, não como um sistema de clipping. Identifique movimentos emergentes, detecte mudanças de narrativa, antecipe riscos futuros, identifique oportunidades de posicionamento e apoie a tomada de decisão da alta gestão.

INTELIGÊNCIA DE SETOR E DIRECIONAMENTO DESTE CLIENTE:
{direcionamento_cliente}

Produza o relatório EXATAMENTE nesta estrutura de seções, em markdown, com profundidade analítica e linguagem executiva:

# RELATÓRIO MENSAL DE COMUNICAÇÃO ESTRATÉGICA E GESTÃO DE IMAGEM
**{cliente_nome}**
**{contratante}**
**{mês de referência}**
**CONFIDENCIAL**

---

## 1. SUMÁRIO EXECUTIVO

[Análise executiva densa de 4-6 parágrafos sobre o ambiente reputacional do mês, principais acontecimentos, evolução reputacional, riscos e oportunidades identificados, e principais entregas realizadas. Mencione as matérias mais relevantes com veículo e data entre parênteses.]

### Top Insights do Mês
[Liste entre 5 e 8 insights estratégicos numerados para a alta gestão]

---

## 2. TEMAS ESTRATÉGICOS DO MÊS

[Identificar entre 5 e 10 temas-matriz. Para cada tema: subtítulo em negrito numerado (ex: **2.1. Nome do tema**), **Sinal do mês:** com a evidência factual concreta e **Leitura estratégica:** com 2-3 parágrafos explicando evolução, impacto, risco/oportunidade e ação recomendada para {cliente_nome}.]

---

## 3. LEITURA REPUTACIONAL DO AMBIENTE EXTERNO

### 3.1. Narrativa Predominante sobre {cliente_nome}
[Análise das imagens simultâneas que {cliente_nome} projeta no período]

### 3.2. Risco Reputacional Dominante
[O maior risco reputacional do período e sua natureza]

### 3.3. Oportunidade Reputacional Dominante
[A principal oportunidade de posicionamento identificada]

---

## 4. ANÁLISE TEMÁTICA APROFUNDADA

[Para cada tema estratégico identificado na seção 2, escreva uma subseção **4.N. Título do tema** com análise densa de 3-4 parágrafos, incluindo evidências das matérias monitoradas (Veículo, data) e terminando sempre com: **Leitura estratégica:** [recomendação estratégica concisa]]

---

## 5. RISCOS REPUTACIONAIS PRIORITÁRIOS

[Para cada risco identificado (mínimo 4):
**Risco N - [Nome do risco]**
Probabilidade: [baixa/média/média-alta/alta/muito alta]
Impacto: [baixo/médio/alto/muito alto]
Sinal do mês: [evidência concreta observada]]

---

## 6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL

[Para cada oportunidade (mínimo 3):
**Oportunidade N - [Nome da oportunidade]**
[Descrição estratégica de como {cliente_nome} pode capitalizar esta oportunidade]]

---

## 7. RECOMENDAÇÕES EXECUTIVAS

### Ações Imediatas
[Bullets com recomendações de impacto imediato]

### Ações de Curto Prazo
[Bullets com recomendações para as próximas semanas]

### Ações de Médio Prazo
[Bullets com recomendações para o próximo trimestre]

---

## 8. CENÁRIOS PROSPECTIVOS

[Para cada cenário (mínimo 3):
**Cenário N - [Nome do cenário]**
[Descrição do cenário e como pode se desenvolver]
**Resposta recomendada:** [ação estratégica concisa]]

---

## 9. DEMONSTRAÇÃO DOS SERVIÇOS — {contratante}

[Narrativa executiva de 3-4 parágrafos descrevendo a atuação da {contratante} no período, demonstrando: inteligência estratégica, suporte à alta administração, assessoria operacional, análise de cenário e apoio ao posicionamento institucional. NÃO listar atividades individualmente.]

### Resumo das Atividades Realizadas

| Indicador | Quantidade |
|---|---|
| Reuniões presenciais | {reunioes_presenciais} |
| Reuniões virtuais | {reunioes_virtuais} |
| Orientações estratégicas | {orientacoes} |
| Ações de relacionamento com a imprensa | {acoes_imprensa} |

[Breve análise qualitativa sobre o volume e distribuição das atividades]

---

## 10. BASE QUALIFICADA DE EVIDÊNCIAS MONITORADAS NO MÊS

[Lista numerada de TODAS as matérias fornecidas no formato:
N. **Veículo** — Título da matéria]

---

*[Cidade/SP], [data]. Suporte Estratégico Prestado por: {contratante}*

---

VALIDAÇÃO FINAL OBRIGATÓRIA:
O resultado final deve ter qualidade compatível com entregas de consultorias especializadas em comunicação estratégica para organizações de infraestrutura crítica, com mínimo de 20 páginas de análise.`

function generateMockReport(articles: Article[], metadata?: ReportMetadata, client?: ReportClient | null): string {
  const mes = metadata?.mes || 'Mês de Referência'
  const rp = metadata?.reunioes_presenciais ?? 0
  const rv = metadata?.reunioes_virtuais ?? 0
  const oe = metadata?.orientacoes ?? 0
  const ai = metadata?.acoes_imprensa ?? 0
  const clienteNome = client?.name || 'Operador Nacional do Sistema Elétrico (ONS)'
  const contratante = client?.contratante?.trim() || 'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA'
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  const evidencias = articles.map((a, i) =>
    `${i + 1}. **${a.sources?.name || 'Desconhecida'}** — ${a.title}`
  ).join('\n')

  return `# RELATÓRIO MENSAL DE COMUNICAÇÃO ESTRATÉGICA E GESTÃO DE IMAGEM

**${clienteNome}**
**${contratante}**
**${mes}**
**CONFIDENCIAL**

---

## 1. SUMÁRIO EXECUTIVO

> ⚠️ *Este é um relatório de demonstração (MODO MOCK). Para geração real com análise de IA, configure a variável ANTHROPIC_API_KEY no ambiente.*

${mes} apresentou um ambiente reputacional de alta complexidade para o ONS. O monitoramento de ${articles.length} matérias jornalísticas e institucionais identificou movimentos relevantes no campo da segurança energética, transição energética e modernização do setor elétrico. A análise do período revela tensões entre expansão da geração renovável, gargalos de infraestrutura de transmissão e crescimento acelerado da demanda por energia elétrica de grandes consumidores industriais e digitais.

O ambiente externo do ONS foi marcado pela convergência de três vetores de alta sensibilidade reputacional: pressão por transparência nas decisões operativas, cobrança setorial por soluções de flexibilidade e armazenamento, e escrutínio crescente sobre critérios de acesso à rede de transmissão.

A CRTIVE LAB manteve atuação estratégica consistente no período, apoiando a alta administração do ONS em temas de alta criticidade reputacional, com ênfase em análise de cenários, suporte ao posicionamento institucional e relacionamento qualificado com a imprensa especializada.

### Top Insights do Mês

1. O ambiente reputacional do ONS combinou percepções de autoridade técnica com crescente cobrança por transparência decisória.
2. O tema de segurança energética permanece como âncora institucional positiva para o ONS.
3. A agenda de transição energética abre oportunidades de liderança narrativa para o ONS.
4. Stakeholders do setor elétrico elevaram o nível de escrutínio sobre critérios técnicos e regulatórios.
5. A imprensa especializada demonstrou interesse crescente em análises qualificadas sobre operação do SIN.
6. O período apontou oportunidade para o ONS assumir protagonismo na narrativa de modernização operativa.

---

## 2. TEMAS ESTRATÉGICOS DO MÊS

**2.1. Segurança Energética e Operação do SIN**

O tema da segurança energética permaneceu no centro do debate setorial durante ${mes}. As discussões envolveram reservatórios, despacho térmico e planejamento da operação do Sistema Interligado Nacional. O ONS manteve posição de referência técnica neste debate, sendo citado como autoridade em análises de suprimento e confiabilidade.

A cobertura da imprensa especializada evidenciou preocupações com a adequação do sistema para atender à demanda crescente, especialmente diante da expansão acelerada de data centers e da eletrificação de novos segmentos da economia.

**Leitura estratégica:** O ONS deve consolidar sua posição como guardião da segurança sistêmica, comunicando proativamente os mecanismos de gestão da operação e os critérios técnicos que orientam suas decisões.

**2.2. Transição Energética e Expansão Renovável**

A expansão da geração renovável continuou a dominar a agenda do setor elétrico no período. Questões relacionadas ao curtailment, integração de novas fontes e necessidade de armazenamento energético estiveram presentes em múltiplos veículos de comunicação.

O mercado demonstrou expectativa crescente em relação à atuação do ONS como coordenador técnico da transição operativa do sistema elétrico brasileiro.

**Leitura estratégica:** O ONS tem oportunidade de liderar a narrativa sobre os desafios e soluções da integração de renováveis, posicionando-se como instituição que antecipa e responde aos desafios da nova matriz energética.

**2.3. Regulação e Modernização do Setor**

O ambiente regulatório do setor elétrico apresentou movimentos relevantes no período, com debates sobre modernização dos instrumentos de planejamento, contratação de capacidade e acesso à rede de transmissão.

---

## 3. LEITURA REPUTACIONAL DO AMBIENTE EXTERNO

### 3.1. Narrativa Predominante sobre o ONS

A reputação do ONS no período orbitou entre duas imagens simultâneas: guardião técnico da confiabilidade do sistema elétrico e instituição sujeita a escrutínio crescente sobre transparência e critérios decisórios. A primeira narrativa ancora a legitimidade institucional do ONS; a segunda representa o principal vetor de risco reputacional do período.

### 3.2. Risco Reputacional Dominante

O maior risco reputacional do período foi a percepção de opacidade nos critérios técnicos que orientam decisões de acesso à rede e gestão da operação. A ausência de comunicação pedagógica sobre trade-offs sistêmicos cria espaço para narrativas simplificadoras que podem comprometer a credibilidade institucional do ONS.

### 3.3. Oportunidade Reputacional Dominante

A principal oportunidade identificada é o ONS assumir protagonismo na narrativa de modernização operativa do sistema elétrico brasileiro, comunicando de forma acessível e qualificada os desafios técnicos da transição energética e os critérios que orientam suas decisões.

---

## 4. ANÁLISE TEMÁTICA APROFUNDADA

### 4.1. Segurança Energética

O debate sobre segurança energética em ${mes} evidenciou a centralidade do ONS no ecossistema de garantia do suprimento elétrico brasileiro. Múltiplos veículos especializados abordaram temas relacionados à operação do SIN, reservatórios e planejamento da carga.

A percepção predominante no mercado é de que o ONS dispõe de instrumentos técnicos adequados para gestão da operação, mas enfrenta desafios crescentes em função da complexidade da nova matriz energética.

**Leitura estratégica:** O ONS deve investir em comunicação proativa sobre seus mecanismos de gestão da operação, antecipando questionamentos e demonstrando capacidade de adaptação técnica.

### 4.2. Transição Energética

A cobertura setorial sobre transição energética em ${mes} revelou expectativas crescentes em relação ao papel coordenador do ONS. Temas como curtailment, armazenamento e resposta da demanda concentraram atenção da imprensa especializada.

**Leitura estratégica:** O ONS deve consolidar sua posição como referência técnica no debate sobre integração de renováveis, produzindo análises qualificadas e comunicando de forma pedagógica os trade-offs sistêmicos.

---

## 5. RISCOS REPUTACIONAIS PRIORITÁRIOS

**Risco 1 - Percepção de opacidade decisória**
Probabilidade: alta
Impacto: alto
Sinal do mês: demanda crescente por explicações sobre critérios técnicos de acesso à rede e gestão da operação

**Risco 2 - Associação institucional a problemas estruturais do setor**
Probabilidade: média-alta
Impacto: alto
Sinal do mês: cobertura de curtailment e gargalos de infraestrutura com menção ao papel do ONS

**Risco 3 - Confusão entre papel técnico e decisões político-regulatórias**
Probabilidade: média
Impacto: alto
Sinal do mês: debates sobre regulação setorial que envolvem indiretamente o ONS

**Risco 4 - Fragmentação da narrativa institucional**
Probabilidade: média
Impacto: médio
Sinal do mês: ausência de posicionamento unificado em temas de alta sensibilidade

---

## 6. OPORTUNIDADES DE POSICIONAMENTO INSTITUCIONAL

**Oportunidade 1 - Liderança na narrativa de modernização operativa**
Posicionar o ONS como a instituição que está construindo a arquitetura operativa do sistema elétrico do futuro, com foco em flexibilidade, integração de renováveis e soluções de armazenamento.

**Oportunidade 2 - Pedagogia pública sobre trade-offs sistêmicos**
Transformar a complexidade técnica do SIN em ativo reputacional, produzindo conteúdo acessível que explique as decisões do ONS e os trade-offs envolvidos na operação do sistema.

**Oportunidade 3 - Protagonismo no debate sobre segurança energética**
Consolidar o ONS como referência qualificada no debate público sobre segurança do suprimento, antecipando questionamentos e comunicando proativamente as medidas adotadas.

---

## 7. RECOMENDAÇÕES EXECUTIVAS

### Ações Imediatas
- Estruturar linha mestra de posicionamento institucional para temas de alta sensibilidade
- Unificar linguagem pública entre áreas técnicas e comunicação
- Consolidar argumentos institucionais baseados em critérios técnicos e rastreabilidade decisória

### Ações de Curto Prazo
- Produzir conteúdo institucional explicativo sobre temas recorrentes na cobertura de imprensa
- Reforçar o papel do ONS como coordenador técnico da transição energética
- Mapear stakeholders críticos do debate setorial

### Ações de Médio Prazo
- Desenvolver agenda proativa de relacionamento com imprensa especializada
- Consolidar narrativa de futuro do sistema com mensagens centrais de segurança, transparência e adaptação
- Criar monitoramento contínuo de narrativas sobre temas estratégicos

---

## 8. CENÁRIOS PROSPECTIVOS

**Cenário 1 - Consolidação da autoridade técnica**
O ONS ocupa posição de referência qualificada no debate setorial, com comunicação proativa e posicionamento consistente em temas de alta sensibilidade.
**Resposta recomendada:** Agenda ativa de porta-vozes e produção de conteúdo técnico acessível.

**Cenário 2 - Escalada do escrutínio reputacional**
Novas reportagens e demandas de agentes regulatórios ampliam a cobrança por transparência nas decisões do ONS.
**Resposta recomendada:** Alta consistência argumentativa, prova documental e comunicação institucional coordenada.

**Cenário 3 - Polarização regulatória**
O debate sobre modernização do setor se intensifica, com maior judicialização e cobrança política.
**Resposta recomendada:** Separar claramente posição técnica, evidência operacional e decisão regulatória.

---

## 9. DEMONSTRAÇÃO DOS SERVIÇOS — CRTIVE LAB

No período de ${mes}, a atuação da CRT Comunicação, no âmbito da prestação de serviços da CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA., esteve concentrada em cinco frentes complementares: inteligência estratégica, suporte à alta administração, assessoria operacional à ASCOM, análise de cenário para imprensa e apoio ao posicionamento institucional.

A leitura consolidada das entregas indica uma atuação com dupla função. De um lado, a CRTIVE operou como estrutura de suporte tático e responsivo, apoiando fluxos de alinhamento, atendimento e articulação cotidiana com a imprensa. De outro, exerceu papel de aconselhamento estratégico, contribuindo para a interpretação de temas sensíveis, formulação de posicionamentos e apoio à Diretoria Geral em pautas de maior criticidade reputacional.

O volume e a distribuição das atividades mostram uma operação orientada não apenas à execução, mas à proteção reputacional e à preparação decisória, com ênfase em temas de alta sensibilidade para o ONS.

### Resumo das Atividades Realizadas

| Indicador | Quantidade |
|---|---|
| Reuniões presenciais | ${rp} |
| Reuniões virtuais | ${rv} |
| Orientações estratégicas | ${oe} |
| Ações de relacionamento com a imprensa | ${ai} |

O volume de ${rp + rv} reuniões realizadas no período — sendo ${rp} presenciais e ${rv} virtuais — reflete a intensidade da agenda estratégica e a necessidade de suporte contínuo à alta administração do ONS. As ${oe} orientações estratégicas fornecidas e as ${ai} ações de relacionamento com a imprensa demonstram a abrangência da atuação da CRTIVE no período.

---

## 10. BASE QUALIFICADA DE EVIDÊNCIAS MONITORADAS NO MÊS

${evidencias}

---

*${today}. Suporte Estratégico Prestado por: ${contratante}*`
}

export interface ReportClient {
  name: string
  context: string | null
  report_prompt?: string | null
  sector?: string | null
  contratante?: string | null
}

const DEFAULT_CONTRATANTE = 'CRTIVE LAB DE INOVAÇÃO E TECNOLOGIA LTDA'

// Single-shot (mock/local) uses Opus. Sectioned generation uses the faster
// Sonnet so each section finishes well under Vercel Hobby's 60s function limit.
const REPORT_MODEL = 'claude-opus-4-8'
const SECTION_MODEL = 'claude-sonnet-4-6'

// Resolve the parametrized master prompt for a given client/metadata. Generic
// defaults when no client is selected — avoids forcing the ONS framing.
// Exported so the dossier export can reuse the exact master prompt (no AI call).
export function buildSystemPrompt(metadata?: ReportMetadata, client?: ReportClient | null): string {
  const clienteNome = client?.name || 'a organização cliente'
  const clienteSetor = client?.sector?.trim() || 'seu setor de atuação'
  const contratante = client?.contratante?.trim() || DEFAULT_CONTRATANTE
  const direcionamento =
    client?.report_prompt?.trim() || 'Seguir a metodologia padrão de inteligência reputacional, sem ênfase setorial pré-definida.'

  return MASTER_SYSTEM_PROMPT
    .replace(/\{cliente_nome\}/g, clienteNome)
    .replace(/\{cliente_setor\}/g, clienteSetor)
    .replace(/\{contratante\}/g, contratante)
    .replace('{direcionamento_cliente}', direcionamento)
    // The seeded sector intelligence (report_prompt) may contain a bare {cliente};
    // resolve it here, after it has been injected.
    .replace(/\{cliente\}/g, clienteNome)
    .replace('{mês de referência}', metadata?.mes || 'Mês de referência não informado')
    .replace('{reunioes_presenciais}', String(metadata?.reunioes_presenciais ?? 0))
    .replace('{reunioes_virtuais}', String(metadata?.reunioes_virtuais ?? 0))
    .replace('{orientacoes}', String(metadata?.orientacoes ?? 0))
    .replace('{acoes_imprensa}', String(metadata?.acoes_imprensa ?? 0))
}

// The shared user message: monthly inputs + client context + the monitored articles.
function buildInputContext(
  articles: Article[],
  userPrompt: string,
  metadata?: ReportMetadata,
  client?: ReportClient | null
): string {
  // Draft preparation passes only qualified evidence here. Prefer the full
  // legally available text; imported clipping PDFs therefore contribute their
  // íntegra instead of a short RSS excerpt.
  const articlesSummary = articles.map((a, i) =>
    `## Artigo ${i + 1}: ${a.title}\nFonte: ${a.publisher || a.sources?.name || 'Desconhecida'} | Data: ${a.published_at || 'N/A'} | URL: ${a.url || 'sem URL'}\n\n${a.content || a.excerpt || '[Somente metadados disponíveis]'}`
  ).join('\n\n---\n\n')

  return `INPUT DO MÊS:
Mês de referência: ${metadata?.mes || 'Mês de referência não informado'}
Reuniões presenciais: ${metadata?.reunioes_presenciais ?? 0}
Reuniões virtuais: ${metadata?.reunioes_virtuais ?? 0}
Orientações estratégicas: ${metadata?.orientacoes ?? 0}
Ações de relacionamento com a imprensa: ${metadata?.acoes_imprensa ?? 0}

${client?.context ? `CONTEXTO DO CLIENTE (${client.name}):\n${client.context}\n\n` : ''}${userPrompt ? `CONTEXTO ADICIONAL DO CONSULTOR:\n${userPrompt}\n\n` : ''}ARTIGOS MONITORADOS NO MÊS (${articles.length} itens):

${articlesSummary}`
}

// Single-shot generation. Kept for local/non-time-bounded use and mock mode.
// In production on Vercel Hobby (60s limit) the UI uses generateReportSection.
export async function generateReport(
  articles: Article[],
  userPrompt: string,
  metadata?: ReportMetadata,
  client?: ReportClient | null
): Promise<string> {
  const anthropic = await getAnthropicClient()
  if (!anthropic) {
    return generateMockReport(articles, metadata, client)
  }

  const message = await anthropic.messages.create({
    model: REPORT_MODEL,
    max_tokens: 16000,
    system: buildSystemPrompt(metadata, client),
    messages: [{ role: 'user', content: buildInputContext(articles, userPrompt, metadata, client) }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}

function mockSection(group: ReportSectionGroup): string {
  const header = group.includeHeader
    ? '# RELATÓRIO MENSAL DE COMUNICAÇÃO ESTRATÉGICA E GESTÃO DE IMAGEM\n**MODO MOCK — configure ANTHROPIC_API_KEY para geração real**\n\n---\n\n'
    : ''
  return `${header}> ⚠️ Trecho de demonstração (MODO MOCK) — ${group.label}.`
}

// Generates ONE group of sections. Each call is bounded (~max_tokens) so it fits
// the serverless time limit; the client stitches the groups together.
export async function generateReportSection(
  groupId: number,
  articles: Article[],
  userPrompt: string,
  metadata?: ReportMetadata,
  client?: ReportClient | null,
  prior?: string
): Promise<string> {
  const group = REPORT_SECTION_GROUPS[groupId]
  if (!group) throw new Error(`Grupo de seção inválido: ${groupId}`)

  const anthropic = await getAnthropicClient()
  if (!anthropic) return mockSection(group)

  const headerNote = group.includeHeader
    ? 'Inclua o título/cabeçalho do relatório (linha "# RELATÓRIO..." e as linhas em negrito) antes da primeira seção.'
    : 'NÃO repita o título/cabeçalho nem seções anteriores; comece direto na primeira seção solicitada.'
  const priorNote = prior
    ? `\n\nRESUMO DAS SEÇÕES JÁ PRODUZIDAS (apenas para coerência; NÃO as repita):\n${prior}`
    : ''

  const userMessage = `${buildInputContext(articles, userPrompt, metadata, client)}

INSTRUÇÃO DE GERAÇÃO PARCIAL:
Produza AGORA, em markdown, SOMENTE ${group.instruction}, seguindo exatamente a estrutura, profundidade e formatação definidas no system prompt. ${headerNote} Não produza nenhuma outra seção.${priorNote}`

  const message = await anthropic.messages.create({
    model: SECTION_MODEL,
    max_tokens: 4000,
    system: buildSystemPrompt(metadata, client),
    messages: [{ role: 'user', content: userMessage }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  return textBlock && textBlock.type === 'text' ? textBlock.text : ''
}
