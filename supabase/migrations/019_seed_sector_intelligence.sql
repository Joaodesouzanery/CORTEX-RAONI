-- 019: semeia a inteligência setorial (antes só em prompts/*.md, uso manual) na
-- coluna clients.report_prompt — unifica a fonte de verdade, usada por
-- buildSystemPrompt (app + dossiê). Idempotente (UPDATE). prompts/*.md ficam
-- como referência.

UPDATE clients SET report_prompt = $sector$
## INTELIGÊNCIA DE SETOR — SETOR ELÉTRICO BRASILEIRO (base de referência para sua análise)

**Contexto institucional do ONS.** O ONS é associação civil de direito privado, sem fins lucrativos, que opera o SIN sob fiscalização e regulação da ANEEL e diretrizes do MME, regido pelos Procedimentos de Rede. Não é agência de governo nem gerador/transmissor — é o coordenador técnico neutro do despacho e da confiabilidade. Toda leitura reputacional deve partir dessa natureza jurídica: cobranças que confundem o Operador com formulador de política (MME/CNPE), com regulador (ANEEL) ou com dono do ativo (geradores/transmissoras) são, em si, um risco de framing a ser corrigido.

**Temas-âncora recorrentes que devem orientar sua leitura:**
- Operação e segurança do **SIN (Sistema Interligado Nacional)**; confiabilidade e continuidade do suprimento; margem de reserva operativa.
- **Apagões e perturbações** (referências críticas: o blackout nacional de 15/08/2023, com origem no elo de transmissão do Nordeste, e a perturbação de 15/08/2024 em São Paulo) — causa raiz, comunicação de crise, atribuição de responsabilidade e a apuração conjunta ONS–ANEEL.
- **Transição energética** e integração massiva de **renováveis intermitentes** (solar e eólica), com concentração no Nordeste e escoamento pela rede básica.
- **Curtailment** (constrained-off/corte de geração renovável por confiabilidade ou por restrição de escoamento) e o litígio com geradores sobre ressarcimento — tema de altíssima sensibilidade reputacional e jurídica, com ações judiciais e pressão de ABEEólica e ABSOLAR.
- **Armazenamento** (baterias/BESS), **inércia sintética**, **serviços ancilares**, controle de frequência/tensão e modernização do parque; a Consulta/Reserva de Capacidade e o debate sobre leilão de baterias.
- **Expansão e gargalos da transmissão**; atrasos de obras, leilões de transmissão da ANEEL, sobrecontratação e capacidade de escoamento (RAP, atrasos de RTs).
- **Segurança energética hídrica** (nível de reservatórios, ENA, GSF/MRE), acionamento de térmicas fora da ordem de mérito por segurança e o impacto no custo (ESS/encargos).
- **Modernização do setor elétrico** (PL de abertura do mercado livre para baixa tensão), formação de preço horário (PLD horário), PDO/PMO e migração de consumidores.
- Governança de dados, transparência das decisões de despacho, publicidade dos relatórios de análise de perturbação (RAP) e **accountability técnica** do Operador.

**Riscos reputacionais típicos do Operador (com vetores concretos):**
- **Atribuição de apagão/perturbação** — ser apontado como causador ou como quem falhou na comunicação de crise; disputa de causa raiz com transmissoras/geradores; exposição em relatório de apuração conjunto com a ANEEL e eventual cobrança do TCU e de CPIs.
- **"Vilão do curtailment"** — narrativa, patrocinada por ABEEólica, ABSOLAR e geradores, de que o ONS destrói valor de renováveis, ordena cortes sem ressarcimento e afugenta investidor estrangeiro; risco de virar tese jurídica e pauta no Congresso.
- **Caixa-preta técnica** — percepção de opacidade nos critérios de despacho de segurança, na constituição da reserva e no acionamento de térmicas caras.
- **Judicialização** — geradores, associações (ABEEólica/ABSOLAR) e a própria ANEEL transformando decisões operativas em contencioso; liminares que fragilizam a autoridade operativa do ONS.
- **Politização da operação** — decisões técnicas lidas como escolha política (térmicas vs. renováveis, custo ao consumidor, interesse regional do Nordeste/Norte); risco de captura do debate por atores partidários.
- **Descompasso de expectativas** — cobrança por confiabilidade absoluta vs. realidade de um sistema com penetração recorde de intermitentes e inércia declinante.
- **Fragmentação do discurso** — múltiplas vozes (associações, ANEEL, MME, agentes) contradizendo a leitura técnica do Operador, esvaziando sua condição de fonte primária.

**Oportunidades de posicionamento institucional:**
- Consolidar o ONS como **guardião técnico e imparcial da confiabilidade** do maior sistema interligado da América Latina, com matriz predominantemente renovável.
- Autoridade científica sobre **transição energética ordenada** — o Operador como quem viabiliza (não freia) as renováveis com segurança, ancorado em dados de recorde de geração renovável e atendimento de picos.
- Liderança na agenda de **armazenamento (BESS), flexibilidade e serviços ancilares** como resposta estrutural ao curtailment — deslocando a narrativa do "corte" para a "solução".
- Transparência proativa e **pedagogia técnica** — explicar publicamente o "porquê" das decisões de despacho e das restrições de escoamento para dissolver a percepção de caixa-preta.
- Protagonismo em **cooperação e benchmarking internacional** de operadores (CAISO, ENTSO-E, Red Eléctrica), posicionando o ONS como referência global em operar sistema de grande porte com alta renovabilidade.

**Stakeholders e órgãos-chave a mapear na análise (cite nomes concretos quando aparecerem no corpus):**
- **Reguladores e formuladores:** ANEEL (regulação, fiscalização e apuração de perturbações), MME (política energética), EPE (planejamento de expansão), CCEE (comercialização, liquidação e câmara do MRE), CNPE (diretrizes de política), IBAMA/MMA (licenciamento e agenda ambiental).
- **Controle, Legislativo e governo central:** TCU, Congresso Nacional (Comissão de Minas e Energia da Câmara, Comissão de Infraestrutura do Senado, eventuais CPIs do Apagão), Casa Civil.
- **Setor e associações:** ABEEólica (eólica), ABSOLAR (solar), ABRACE e ABRACEEL/Abraceel (grandes consumidores e comercializadores), ABRADEE (distribuidoras), ABRATE (transmissoras), APINE (geradoras independentes), além de geradores, transmissoras, distribuidoras e consumidores livres individualmente citados.
- **Imprensa especializada e econômica:** Canal Energia, epbr, MegaWhat, Broadcast Energia (Agência Estado), Valor Econômico, Folha de S.Paulo, O Estado de S. Paulo, O Globo, InfoMoney, além de imprensa regional (Nordeste e Norte, sobretudo, pela concentração de renováveis e obras de transmissão).
- **Externos:** investidores e fundos (nacionais e estrangeiros) expostos a geração renovável e transmissão, CEPEL e universidades/centros de pesquisa, operadores internacionais e entidades multilaterais.
$sector$
WHERE name = 'ONS';

UPDATE clients SET report_prompt = $sector$
## INTELIGÊNCIA DE SETOR — COMERCIALIZAÇÃO DE ENERGIA ELÉTRICA (BRASIL)

Use este conhecimento setorial como lente de análise obrigatória. Não o reproduza como texto solto; aplique-o para interpretar as matérias. A CCEE é a **contraparte central de compensação e liquidação (clearing house)** do mercado brasileiro de energia: contabiliza a energia transacionada por todos os agentes, calcula e liquida financeiramente as diferenças no mercado de curto prazo, apura o PLD, administra as garantias e opera os leilões por delegação da ANEEL/MME. Sua reputação repousa sobre três pilares — **neutralidade técnica, integridade dos dados e robustez da liquidação** — e é por esses três eixos que os riscos reputacionais tipicamente atacam.

### Temas-âncora recorrentes do setor
- **Abertura/expansão do mercado livre (ACL)**: cronograma de abertura para consumidores de baixa tensão (grupo B — residências e pequeno comércio), migração do ACR para o ACL, a regulamentação da MP 1.300/2025 e do PL da abertura, o papel da CCEE como operadora do mercado varejista e o desenho do supridor de última instância e do comercializador varejista/regulado.
- **PLD (Preço de Liquidação das Diferenças)** e formação de preço: transição do PLD horário, teto e piso definidos pela ANEEL, descolamento entre PLD e Custo Marginal de Operação (CMO), influência do ONS via despacho e o debate sobre a formação de preço por oferta (price maker).
- **Leilões** (energia nova A-4/A-5/A-6, existente, reserva de capacidade, transmissão) e contratação — sinais de preço e de política energética conduzidos por EPE/MME e operacionalizados pela CCEE.
- **Liquidação financeira, inadimplência e garantias**: risco de calote de comercializadora no mercado de curto prazo, execução de garantias, rateio de inadimplência entre agentes adimplentes (o "efeito dominó"), e o histórico sensível de disputas judiciais que travam liquidações mensais.
- **Reforma/modernização do setor elétrico**: MP 1.300/2025, PLs em tramitação no Congresso, redesenho de encargos e subsídios, portabilidade da conta de luz, redução do consumidor cativo.
- **Sobreoferta, curtailment e geração renovável**: excesso estrutural de oferta, constrained-off (corte) de eólicas e solares no Nordeste com ressarcimento contestado, expansão da geração distribuída (GD) sob a Lei 14.300/2022 e seu impacto no rateio de custos e no Fio B.
- **Sustentabilidade tarifária e "conta de luz"**: quem paga a conta da transição e dos subsídios, impacto ao consumidor cativo, CDE (Conta de Desenvolvimento Energético), encargos setoriais e bandeiras tarifárias.
- **Segregação de lastro e energia**, mercado de capacidade, e novos produtos: hidrogênio de baixo carbono (marco legal), armazenamento/baterias, RECs/I-RECs e o Sistema Brasileiro de Comércio de Emissões (SBCE, Lei 15.042/2024).
- **Governança, transparência e integridade da própria CCEE**: confiabilidade dos dados do InfoMercado, tempestividade da liquidação mensal, ciclo de contabilização, e a percepção pública sobre a neutralidade da Câmara.

### Principais RISCOS reputacionais típicos
- **Risco de captura/legitimidade**: percepção de que a CCEE favorece um elo da cadeia — comercializadoras (ABRACEEL), grandes consumidores (ABRACE), geradoras (ABRAGE, ABEEólica, ABSOLAR) ou distribuidoras (ABRADEE) — comprometendo sua imagem de árbitro neutro.
- **Risco de "quem paga a conta"**: vinculação da abertura de mercado e dos subsídios (GD, carvão, térmicas contratadas fora da ordem de mérito) ao aumento da tarifa do consumidor cativo — narrativa politicamente explosiva que costuma ser encampada por parlamentares, PROCONs e o IDEC.
- **Risco de crise de liquidação/inadimplência**: calote de comercializadora, insuficiência de garantias, rateio de perdas entre adimplentes e a CCEE vista como incapaz de proteger o mercado — o cenário mais destrutivo para a credibilidade da Câmara como clearing house.
- **Risco de insegurança jurídica**: judicialização de regras que suspende liquidações, liminares contra decisões da ANEEL/MME, o legado do GSF (risco hidrológico) e o descasamento entre regra vigente e liquidação efetiva.
- **Risco de opacidade/dado errado**: falha, atraso ou inconsistência em dados, PLD contestado, erro no InfoMercado ou no ciclo de contabilização — erosão direta do pilar de integridade técnica.
- **Risco político-regulatório**: a CCEE apanhar no fogo cruzado entre MME, ANEEL, Congresso, TCU e agentes de mercado durante a tramitação de reformas (MP 1.300/2025), sendo responsabilizada por escolhas que não são suas.
- **Risco de complexidade percebida**: o mercado visto como "caixa-preta" incompreensível ao consumidor comum, minando a legitimidade social da abertura da baixa tensão.

### OPORTUNIDADES de posicionamento institucional
- Posicionar a CCEE como **árbitro técnico neutro e infraestrutura crítica de mercado confiável** — o clearing house do setor elétrico brasileiro, análogo à B3 no mercado financeiro.
- Liderar a **pedagogia da abertura de mercado** — traduzir o ACL, a portabilidade da conta de luz e a migração para o consumidor de baixa tensão e para a sociedade, ancorando confiança antes que a narrativa de "aumento de tarifa" se consolide.
- Ocupar o espaço de **autoridade de dados e transparência** (PLD, InfoMercado, boletins, dados abertos) como bem público setorial, reforçando o pilar de integridade.
- Protagonismo na **transição energética e novos mercados** — operacionalização do SBCE (mercado de carbono), certificados de energia renovável, hidrogênio e armazenamento — posicionando a CCEE como plataforma de futuro, não apenas de liquidação.
- Demonstrar **robustez da liquidação e das garantias** com dados concretos de adimplência e execução como prova de estabilidade sistêmica.

### STAKEHOLDERS-chave
Comercializadoras e a **ABRACEEL** (Associação Brasileira dos Comercializadores de Energia); grandes consumidores livres e a **ABRACE** (Associação Brasileira de Grandes Consumidores de Energia e Consumidores Livres); geradoras e associações como **ABRAGE** (grandes geradoras), **ABEEólica** (eólica), **ABSOLAR** (solar/GD), **APINE** (produtores independentes) e **ABRAGEL** (PCHs); distribuidoras e a **ABRADEE**; térmicas a gás e a **ABEGÁS/Abraget**; investidores, bancos e fundos que financiam PPAs; consumidores cativos e órgãos de defesa (PROCONs, **IDEC**, Senacon); imprensa especializada (**Canal Energia, epbr, MegaWhat, Broadcast Energia, Valor**); e o Congresso Nacional, com destaque para a **Frente Parlamentar Mista da Energia**.

### ÓRGÃOS reguladores/entidades relevantes
**ANEEL** (Agência Nacional de Energia Elétrica — regulador e delegante da CCEE); **MME** (Ministério de Minas e Energia — formulador de política); **CCEE** (a própria — operadora do mercado); **ONS** (Operador Nacional do Sistema — despacho e operação); **EPE** (Empresa de Pesquisa Energética — planejamento e leilões); **CNPE** (Conselho Nacional de Política Energética — diretrizes); **CMSE** (Comitê de Monitoramento do Setor Elétrico — segurança de suprimento); **TCU** (controle externo de leilões e subsídios); Congresso Nacional (tramitação da MP 1.300/2025 e PLs de reforma); e, no eixo consumidor, PROCONs, IDEC e Senacon.
$sector$
WHERE name = 'CCEE';

UPDATE clients SET report_prompt = $sector$
### INTELIGÊNCIA DE SETOR — GÁS NATURAL E GERAÇÃO TÉRMICA (BRASIL)
Use este repertório para interpretar as matérias com profundidade de especialista. Não é para ser copiado no relatório: é seu conhecimento de fundo para gerar análise densa e correta.

**Temas-âncora recorrentes do setor:**
- **Novo Mercado de Gás** (Lei 14.134/2021 e Decreto 10.712/2021): abertura à competição, acesso negociado/regulado a gasodutos de transporte e a terminais de GNL, desverticalização e desinvestimentos da Petrobras (TAG, NTS, distribuidoras), atuação do CADE e os acordos de cessação (TCC) que destravaram a saída da Petrobras das distribuidoras. Ritmo real de entrada de novos supridores vs. dominância remanescente da Petrobras.
- **Preço e oferta da molécula**: competitividade do gás nacional vs. GNL importado, gás do pré-sal e reinjeção, fim do contrato com a Bolívia (GSA) e novos arranjos, indexação (Brent vs. Henry Hub/TTF), tarifas de transporte, e o custo do gás como componente do "custo-Brasil" e da reindustrialização (indústria química, fertilizantes, vidro, cerâmica, siderurgia).
- **Escoamento e infraestrutura**: monetização do gás associado do pré-sal, Rotas 1/2/3 (a Rota 3 e o polo GasLub/Comperj), UPGNs, terminais de regaseificação de GNL, malha de gasodutos de transporte e a assimetria regional (regiões sem malha).
- **Geração termelétrica**: papel das térmicas na segurança e na confiabilidade do sistema, complementaridade à hidro e às renováveis intermitentes (eólica/solar), curva do "pato" e rampa do fim de tarde, despacho por ordem de mérito vs. despacho fora da ordem de mérito e por inflexibilidade, custo do "seguro térmico", GNT (Geração Não Térmica) e a discussão de reserva de capacidade (Leilões de Reserva de Capacidade - LRCAP).
- **Contratação por lei e "jabutis"**: a herança da Lei 14.182/2021 (privatização da Eletrobras) com a obrigação de contratar térmicas a gás (as "térmicas inflexíveis") em regiões sem oferta de gás e sua repercussão de custo na conta de luz; PLs e MPs correlatos em tramitação; a fiscalização do TCU sobre esses custos.
- **Transição energética e descarbonização**: gás como "combustível de transição/ponte", pressão ESG e de investidores, emissões de metano (fugitivas e de venting), CCUS (captura, uso e armazenamento de carbono), hidrogênio (verde/azul), biometano (RenovaBio, potencial de aterros e agro), mercado regulado de carbono (PL do SBCE / Lei 15.042/2024).
- **Distribuição e tributação**: papel das distribuidoras estaduais (concessões estaduais), tarifas de distribuição, revisões tarifárias, ICMS do gás, contratos take-or-pay, migração de consumidores livres/cativos industriais, e o consumidor residencial (gás encanado/GLP como referência sensível de opinião pública).
- **Geopolítica e preço internacional**: Henry Hub (EUA), TTF (Europa), câmbio, ciclo de oferta global de GNL, conflitos e reordenamentos de fluxo que afetam disponibilidade e preço do GNL importado.

**Principais RISCOS reputacionais típicos do setor:**
- Enquadramento do gás/térmica como **"vilão do tarifaço"** — despacho e inflexibilidade das térmicas apontados como causa do aumento da conta de luz, com repasse ao consumidor (bandeiras tarifárias, encargos). Gatilhos típicos: reajustes da ANEEL, acionamento de bandeira vermelha, relatórios do TCU e falas de parlamentares/entidades de consumidores.
- Narrativa de **"contramão da transição energética"** / lock-in fóssil / greenwashing; pressão de investidores ESG, fundos com política de descarbonização e ativismo climático (Observatório do Clima, Greenpeace, Instituto Escolhas, ClimaInfo). Risco de contestação de metas e de dados de emissão de metano.
- Percepção de **"jabuti"/privilégio regulatório** — contratação de térmicas por lei sem leilão competitivo, gasodutos e usinas em regiões sem malha bancados pelo consumidor (a controvérsia das "térmicas inflexíveis" da Lei 14.182/2021), sob escrutínio do TCU, do MPF e de colunistas de economia.
- Associação a **Petrobras / dominância de mercado** e captura regulatória, travando a percepção de abertura efetiva do Novo Mercado de Gás; risco de {cliente} ser lida como beneficiária do status quo ou, inversamente, como agente que "não entrega" competição prometida.
- **Emissões de metano** e passivos socioambientais de dutos, terminais e usinas: licenciamento (IBAMA/órgãos estaduais), conflitos com comunidades e pescadores, condicionantes, e exposição a monitoramento por satélite (dados de metano ganhando tração na imprensa).
- **Insegurança de suprimento / risco de apagão** e a responsabilização das térmicas por indisponibilidade, atraso de comissionamento ou custo excessivo do "seguro"; exposição em anos hidrológicos críticos.
- **Volatilidade de preço ao consumidor industrial** e a acusação de "gás caro" travando a reindustrialização — pauta cara à Abrace, CNI e Fiesp, com potencial de coalizão industrial contra o setor de oferta.

**OPORTUNIDADES de posicionamento típicas:**
- Gás como **âncora de confiabilidade e de firmeza** para viabilizar a expansão de eólica e solar (backup despachável para a intermitência) — mensagem tecnicamente sólida junto a ONS, EPE e ANEEL.
- Protagonismo na **reindustrialização e no custo-Brasil**: gás competitivo como insumo para indústria química, fertilizantes e substituição de combustíveis mais poluentes (óleo, carvão, diesel) — aliança de agenda com CNI/Fiesp/Abrace.
- Liderança construtiva na consolidação do **Novo Mercado de Gás**: defesa da concorrência, do acesso a infraestrutura e da previsibilidade regulatória — posicionamento de "quem quer o mercado funcionar", diferenciando-se da inércia.
- Agenda de **descarbonização pragmática e verificável**: biometano, hidrogênio, CCUS, redução mensurada de metano e substituição de combustíveis mais intensivos em carbono — respondendo à pressão ESG com dado, não com discurso.
- **Segurança energética e soberania**: monetização do gás nacional do pré-sal reduzindo dependência de importação e vulnerabilidade cambial/geopolítica.
- **ESG factual e mensurável**: transparência de dados de emissão, metas auditáveis, relato conforme (TCFD/ISSB) e diálogo estruturado com comunidades e reguladores.

**STAKEHOLDERS-chave e ÓRGÃOS/entidades relevantes (repertório nominal):**
- **Governo/reguladores**: Ministério de Minas e Energia (MME); Agência Nacional do Petróleo, Gás Natural e Biocombustíveis (ANP); Empresa de Pesquisa Energética (EPE); Operador Nacional do Sistema Elétrico (ONS); Câmara de Comercialização de Energia Elétrica (CCEE); Agência Nacional de Energia Elétrica (ANEEL); Conselho Nacional de Política Energética (CNPE); Comitê de Monitoramento do Setor Elétrico (CMSE); Conselho Administrativo de Defesa Econômica (CADE); IBAMA e órgãos ambientais estaduais.
- **Poderes e controle**: Congresso Nacional (Frente Parlamentar Mista da Energia, Frente do Gás Natural; relatorias de MPs e PLs do setor); Tribunal de Contas da União (TCU); Casa Civil; Ministério da Fazenda (efeito da conta de luz sobre inflação/IPCA); Ministério Público Federal (MPF).
- **Empresas e concorrentes**: Petrobras (supridor incumbente e ex-monopolista da rede); Eneva (integrada gás-a-fio, reserva de capacidade); Compass (Cosan) e sua Comgás; Prisma Energia/Commit Gás; Origem Energia; 3R/PRIO e demais produtores independentes; distribuidoras estaduais (Comgás, Naturgy, Sulgás, Gás Brasiliano, Bahiagás, Cegás etc.); traders e importadores de GNL; geradoras térmicas.
- **Entidades setoriais e patronais**: Abegás (distribuidoras de gás canalizado); IBP (Instituto Brasileiro de Petróleo e Gás); Abraceel (comercializadores de energia); Abrace/Abrace Energia (grandes consumidores industriais de energia e gás); Abiogás (biometano); ABGD e associações de geração distribuída; CNI e Fiesp (indústria); Instituto Acende Brasil.
- **Sociedade civil, ESG e clima**: Observatório do Clima, Instituto Escolhas, IEMA, ClimaInfo, Greenpeace; investidores institucionais e fundos com política de descarbonização; agências de rating ESG.
- **Formadores de opinião e imprensa**: especializada (epbr, CanalEnergia, MegaWhat, Petronotícias, Broadcast Energia/Estadão, Valor Econômico, agenciapetrobras/Agência Brasil, Reuters/Bloomberg em energia); colunistas de energia e economia; think tanks (FGV Energia, CBIE, Instituto Escolhas); analistas de mercado (bancos de investimento, casas de research setoriais, CBIE, PSR, Volt Robotics).
$sector$
WHERE name = 'Gás Natural';

UPDATE clients SET report_prompt = $sector$
### INTELIGÊNCIA DE SETOR — MINERAÇÃO E MINERAIS CRÍTICOS (BRASIL)
Use este repertório como lente permanente de análise. Ele NÃO substitui as matérias fornecidas — serve para contextualizar, hierarquizar e dar profundidade à leitura. Trate cada item abaixo como gatilho de interpretação: ao encontrar o tema no material, conecte-o à cadeia de consequências regulatória, política, social e de capitais.

**Temas-âncora recorrentes do setor:**
- **Licenciamento ambiental** (federal e estadual): PL 2.159/2021 (novo marco do Licenciamento Ambiental, a "Lei Geral"), Licença Ambiental por Adesão e Compromisso (LAC), licenciamento trifásico (LP, LI, LO), condicionantes, insegurança jurídica e o embate entre IBAMA/órgãos estaduais e o setor produtivo.
- **Segurança de barragens de rejeitos**: Política Nacional de Segurança de Barragens (Lei 12.334/2010, atualizada pela Lei 14.066/2020), proibição do método de alteamento a montante, descaracterização de estruturas, Plano de Ação de Emergência para Barragens de Mineração (PAEBM), Nível de Emergência (NE1/NE2/NE3), Zona de Autossalvamento (ZAS), fiscalização da ANM — com memória viva de Mariana (Samarco, 2015) e Brumadinho (Vale, 2019, 272 mortos).
- **Minerais críticos e estratégicos**: terras raras (Serra Verde/GO, em produção), lítio ("Vale do Lítio" em Araçuaí/Itinga no Jequitinhonha/MG; Sigma Lithium; CBL), nióbio (CBMM em Araxá/MG, ~80% da produção global), grafita, níquel, cobre, cobalto, manganês, estanho — sob o discurso da transição energética global e da segurança de suprimento (baterias, eletromobilidade, defesa).
- **Royalties e CFEM** (Compensação Financeira pela Exploração de Recursos Minerais): base de cálculo, alíquotas por substância, distribuição entre União/estados/municípios, dependência fiscal de municípios mineradores (ex.: cinturão do Quadrilátero Ferrífero e Carajás) e pressão por majoração/revisão.
- **ESG, descarbonização e economia circular**: metas de neutralidade de carbono (escopos 1, 2 e 3), reaproveitamento e beneficiamento de rejeitos, mineração de baixo carbono, TSF (tailings storage) a seco/empilhamento a seco, recuperação de áreas degradadas (PRAD) e Padrão Global de Gestão de Rejeitos (GISTM).
- **Relação com comunidades e licença social para operar**: reassentamento, consulta prévia livre e informada (Convenção 169 da OIT), atingidos, ruído/poeira/tráfego, distribuição de benefícios e "direito de veto" social de fato.
- **Mineração em terras indígenas** (PL 191/2020) e **garimpo ilegal** (crise sanitária e humanitária Yanomami em Roraima como referência reputacional de contágio setorial; rastreabilidade e origem do ouro; Cadeia Produtiva do Ouro / DTVMs).
- **Geopolítica dos minerais críticos**: concentração da cadeia de processamento na China, Inflation Reduction Act (EUA), Critical Raw Materials Act (UE), acordos de offtake, soberania e política mineral brasileira (Pró-Minerais Estratégicos, Comitê Interministerial de Análise de Projetos de Minerais Estratégicos - CTAPME).

**Principais RISCOS reputacionais típicos:**
- Ruptura, elevação de Nível de Emergência (NE) ou falha em PAEBM de barragem de rejeitos — risco existencial que ativa diretamente a "licença social para operar".
- Passivo socioambiental: contaminação hídrica (metais pesados, assoreamento de rios), poluição do ar por particulados, impacto sobre comunidades, remoção e reassentamento contestados.
- Judicialização e controle: autuações do IBAMA/ANM, embargos, Termos de Ajustamento de Conduta (TAC), Ações Civis Públicas do MPF/MP estaduais, decisões do STF/STJ e passivos trabalhistas.
- Percepção de "captura" de CFEM/royalties e de benefícios sem retorno visível e mensurável às comunidades e municípios impactados.
- Contágio setorial por associação a garimpo ilegal, desmatamento, invasão de terras indígenas e violação de direitos — mesmo sem envolvimento direto de {cliente}.
- Insegurança jurídica do licenciamento gerando enquadramento de "impasse desenvolvimentista" ou de "flexibilização/retrocesso ambiental" (a depender do polo político).
- **Greenwashing / social-washing**: descolamento entre discurso ESG e prática operacional, exposto por ONGs, imprensa investigativa ou relatórios de terceiros.
- Segurança e saúde ocupacional: acidentes fatais, condições de trabalho em minas subterrâneas e a céu aberto.

**OPORTUNIDADES de posicionamento institucional:**
- Protagonismo na **transição energética** como fornecedor confiável e rastreável de minerais críticos indispensáveis (nióbio, lítio, cobre, terras raras, grafita) — narrativa de "matéria-prima do futuro".
- Liderança demonstrável em **segurança de barragens**: descaracterização concluída de estruturas a montante, migração para empilhamento a seco e adesão ao GISTM como novo padrão de indústria.
- Narrativa de **soberania e desenvolvimento nacional** (Brasil como potência de minerais estratégicos, verticalização e industrialização doméstica em vez de exportação de minério bruto).
- Investimento social territorial **mensurável e auditável**, desenvolvimento econômico local e planejamento de diversificação para o pós-mina (fechamento de mina).
- Inovação em reaproveitamento de rejeitos, mineração de baixo carbono, uso de energia renovável e recuperação de áreas.
- Diálogo estruturado com comunidades, consulta prévia qualificada e transparência radical (dados abertos de monitoramento) como diferencial competitivo e blindagem reputacional.

**STAKEHOLDERS-chave e ÓRGÃOS reguladores/entidades relevantes (usar nomes reais; nunca atribuir a {cliente} fato de terceiro):**
- **Reguladores/Governo federal:** ANM (Agência Nacional de Mineração), IBAMA, MME (Ministério de Minas e Energia), MMA (Ministério do Meio Ambiente e Mudança do Clima), ICMBio, ANA (Agência Nacional de Águas e Saneamento), FUNAI, IPHAN (patrimônio arqueológico), MPF e Ministérios Públicos estaduais, TCU, CVM e Banco Central (rastreabilidade do ouro).
- **Órgãos e governos estaduais:** SEMAD/FEAM/IEF e COPAM (MG); SEMAS/IDEFLOR (PA); SECIMA/órgãos ambientais (GO, BA, TO); defesas civis estaduais e municipais.
- **Legislativo:** Congresso Nacional, Frente Parlamentar da Mineração (FPMineral), frente parlamentar ambientalista, CPIs eventuais (ex.: barragens), assembleias legislativas dos estados mineradores.
- **Setor/associações:** IBRAM (Instituto Brasileiro de Mineração), ABIMM, sindicatos patronais e SINDIEXTRA (MG), ABPM (pesquisa mineral), ANM enquanto agência, ICMM (referência internacional).
- **Trabalho:** Metabase e federações mineiras, CNM (Confederação Nacional dos Metalúrgicos), sindicatos laborais regionais.
- **Sociedade civil/comunidades:** MAB (Movimento dos Atingidos por Barragens), Cáritas, ISA (Instituto Socioambiental), Observatório da Mineração, ONGs ambientais, associações de atingidos, Conselho Indigenista Missionário (CIMI), povos indígenas e quilombolas.
- **Mercado/capitais:** investidores institucionais e fundos ESG, agências de rating e ESG (S&P, Moody's, MSCI, Sustainalytics), B3 e bolsas internacionais (NYSE, TSX, ASX), analistas de commodities (ferro, cobre, lítio), seguradoras e resseguradoras.
- **Judiciário, controle e reparação:** STF, STJ, Justiça Federal, Defensoria Pública, Fundação Renova (reparação Mariana) e Instituto Cultural Vale/estruturas de reparação de Brumadinho — como referências de contágio/benchmark, nunca de atribuição.
- **Pares e benchmarks setoriais** (referência de contágio/comparação, jamais atribuir a {cliente}): Vale, Anglo American, CSN Mineração, CBMM, Sigma Lithium, Serra Verde, AngloGold Ashanti, Kin-ross, Nexa, Samarco, Bamin/Eneva, Alcoa/Hydro (bauxita/alumínio no PA).
$sector$
WHERE name = 'Mineração';

UPDATE clients SET report_prompt = $sector$
## INTELIGÊNCIA DE SETOR — TRANSPORTE AQUAVIÁRIO E HIDROVIAS (BASE DE CONHECIMENTO)

Use este repertório setorial para contextualizar, interpretar e nomear corretamente atores, temas e riscos. NÃO o transcreva mecanicamente — mobilize-o apenas onde as matérias tocarem cada ponto. O DNIT Aquaviária (via DAQ) é o órgão executor da União para infraestrutura hidroviária de transporte; sua reputação se joga na tensão entre **entregar navegabilidade** (calado, eclusas, balizamento) e **fazê-lo com legitimidade socioambiental e integridade de execução**. Toda leitura deve situar o DNIT nesse eixo.

**Temas-âncora recorrentes do setor:**
- **Hidrovias e navegação interior:** Hidrovia Tietê-Paraná (corredor de grãos e cana de SP/MS/PR/GO), Hidrovia do Rio Madeira (escoamento de soja de Rondônia/MT via Porto Velho–Itacoatiara), Hidrovia Paraguai-Paraná (corredor internacional Mercosul, minério e grãos, Corumbá/Ladário), Hidrovia do São Francisco, Hidrovia Tocantins-Araguaia, Hidrovia do Rio Paraná; conectividade com o agronegócio, escoamento de grãos, redução do custo por tonelada-quilômetro e desafogamento do modal rodoviário.
- **Dragagem e manutenção de calado:** dragagem de aprofundamento e de manutenção, assoreamento, derrocamento de pedrais (com destaque para o **Pedral do Lourenço**, no rio Tocantins, obra-símbolo pela sensibilidade ambiental e prazos), gestão e disposição de material dragado, licenciamento ambiental de obras junto ao IBAMA e órgãos estaduais.
- **Eclusas e transposição de barragens:** eclusas de Tucuruí (Tocantins), Jupiá, Ilha Solteira, Barra Bonita, Bariri, Ibitinga, Promissão, Nova Avanhandava (Tietê-Paraná); disponibilidade operacional, filas de espera, paradas para manutenção, integração de operação e conflito eventual com o uso energético dos reservatórios (interface com o setor elétrico/ONS).
- **Portos fluviais e terminais:** IP4 (Instalações Portuárias Públicas de Pequeno Porte, foco social na Amazônia), portos e terminais de Manaus, Santarém, Porto Velho, Corumbá, Itaituba/Miritituba; terminais de uso privado (TUP) e sua interface regulatória com a ANTAQ.
- **Navegabilidade sob estresse climático:** secas extremas na Amazônia (impacto no Madeira, no Solimões, no Amazonas e em Manaus, com registros históricos de mínimas em 2023–2024), estiagens que interrompem navegação, encarecem o frete e isolam populações ribeirinhas; cheias e eventos extremos; previsibilidade hidrológica e cotas de referência.
- **Marco regulatório e concessões:** BR do Mar (cabotagem), planejamento de outorgas e concessões de hidrovias via **PPI/Casa Civil**, sinalização náutica e balizamento, cartas náuticas, EVTEA de hidrovias, PNLT/PNL e o debate sobre matriz de transportes.
- **Segurança da navegação e meio ambiente:** acidentes e naufrágios, transporte fluvial de passageiros na Amazônia (competência de fiscalização da Marinha/DPC), impacto socioambiental de intervenções, comunidades ribeirinhas, povos indígenas e quilombolas, consulta prévia (Convenção 169 da OIT).

**Principais RISCOS reputacionais típicos do setor:**
- **Ambiental/socioambiental:** obras de dragagem e derrocamento (notadamente o Pedral do Lourenço) associadas a dano a ecossistemas aquáticos, à ictiofauna e à pesca artesanal, a comunidades ribeirinhas, indígenas e quilombolas; falhas ou ausência de consulta prévia; embargos, condicionantes descumpridas, inquéritos civis e ações civis públicas do **MPF** e do IBAMA.
- **Execução e capacidade de entrega:** obras atrasadas, paralisadas, re-licitadas ou com sobrepreço; baixa execução orçamentária e contingenciamento; frustração de expectativas do agronegócio e de governos estaduais que cobram calado e previsibilidade de escoamento.
- **Controle e integridade:** apontamentos e determinações do **TCU** e da **CGU**, licitações e contratos de dragagem questionados, sobrepreço, aditivos, e o passivo histórico de escândalos do DNIT (que contamina a leitura pública de qualquer irregularidade nova).
- **Segurança e vidas:** acidentes de navegação, insuficiência de sinalização/balizamento atribuída ao órgão, tragédias com embarcações de passageiros na Amazônia — mesmo quando a competência primária é da Marinha, o DNIT pode ser associado à "falta de infraestrutura segura".
- **Clima e continuidade:** incapacidade percebida de manter navegabilidade em seca extrema, com alta do frete, desabastecimento de combustível e alimentos e crise humanitária ribeirinha — narrativa de "governo ausente no rio".
- **Disputa federativa e regulatória:** conflito ou vácuo de competências entre DNIT, **ANTAQ** (regulação/outorga), **Ministério dos Transportes** (tutela), **Marinha/DPC** (segurança da navegação), **ANA** (recursos hídricos), estados e concessionárias — risco de "ninguém é responsável".

**OPORTUNIDADES de posicionamento institucional:**
- Posicionar a DAQ/DNIT como **agente do transporte de baixo carbono e alta eficiência logística** (a hidrovia como o modal de menor emissão e menor custo por tonelada-quilômetro; contribuição para uma matriz de transportes mais equilibrada e para metas de descarbonização/agenda ESG e COP).
- Narrativa de **integração regional e inclusão da Amazônia** (navegação como serviço público essencial a populações isoladas; IP4 como infraestrutura social).
- Vitrine de **entregas concretas**: quilômetros navegáveis recuperados, calado assegurado em safra, eclusas com disponibilidade elevada, trechos derrocados, balizamento renovado.
- **Segurança da navegação e modernização** (balizamento, sinalização náutica, cartas atualizadas, sistemas de monitoramento de cotas) como agenda de "vidas preservadas e safra escoada".
- **Sustentabilidade e licenciamento responsável** (condicionantes cumpridas, programas de compensação, diálogo com comunidades) como diferencial de execução que blinda o órgão.

**STAKEHOLDERS-chave e ÓRGÃOS relevantes (nomes concretos):**
- **Reguladores/gestores federais:** Ministério dos Transportes (tutela do DNIT); DNIT e sua Diretoria de Infraestrutura Aquaviária (DAQ); ANTAQ – Agência Nacional de Transportes Aquaviários (regulação e outorgas); Marinha do Brasil / Diretoria de Portos e Costas (DPC), Tribunal Marítimo e Capitanias dos Portos (segurança da navegação, habilitação, inquéritos de acidentes); Ministério de Portos e Aeroportos / Secretaria Nacional de Portos e Transportes Aquaviários (interface portuária marítima); Casa Civil e Secretaria Nacional (PPI) para concessões; EPL/Ministério dos Transportes para planejamento (PNL).
- **Controle, fiscalização e ambiental:** TCU, CGU, MPF, AGU, IBAMA e ICMBio, órgãos estaduais de meio ambiente (ex.: SEMAS, Naturatins), FUNAI e Fundação Palmares (comunidades tradicionais), ANA (recursos hídricos e cotas).
- **Legislativo:** Comissões de Infraestrutura (CI) do Senado e de Viação e Transportes (CVT) da Câmara; bancadas regionais (Norte e Centro-Oeste) e frentes parlamentares do agronegócio e da Amazônia; TCU como braço de accountability acionado por parlamentares.
- **Setor privado e representativo:** CNA e Aprosoja (produtores rurais), associações de armadores e do transporte hidroviário de cargas, operadores de terminais e TUPs, empreiteiras e dragadoras contratadas, concessionárias de hidrovias/eclusas; entidades técnicas do setor logístico.
- **Sociedade e territórios:** comunidades ribeirinhas, povos indígenas e quilombolas (notadamente no Tocantins e na calha amazônica), pescadores artesanais, ONGs socioambientais, governos estaduais e municipais amazônicos e do Centro-Oeste, Defesa Civil (nos episódios de seca/cheia).
$sector$
WHERE name = 'DNIT Aquaviária';

UPDATE clients SET report_prompt = $sector$
### C. INTELIGÊNCIA DE SETOR — INFRAESTRUTURA RODOVIÁRIA (o que você já sabe do domínio)

Use este conhecimento setorial como lente de análise, mas ancore as conclusões nas matérias recebidas.

**Temas-âncora recorrentes do setor:**
- Estado de conservação e manutenção de rodovias federais (buracos, pavimento, sinalização horizontal/vertical, roçada, drenagem); contraste "tapa-buraco/CREMA" x recuperação estrutural; qualidade medida pela Pesquisa CNT de Rodovias.
- Obras de arte especiais (OAE): pontes, viadutos e túneis — interdições, laudos estruturais, limitação de peso, risco de colapso, manutenção preventiva; casos emblemáticos (ex.: Ponte Rio-Niterói, ponte sobre o Rio Moju/PA, travessias em BRs críticas).
- Obras de duplicação, ampliação de capacidade, contornos e travessias urbanas; atrasos, aditivos, reequilíbrios, paralisações por falha de empreiteira e obras inacabadas ("obras zumbis").
- Segurança viária: índices de acidentes e mortes (dados PRF), pontos críticos, Programa BR-Legal (sinalização e dispositivos), defensas metálicas, faixas adicionais em serra.
- Concessões e desestatização: relação DNIT × ANTT × concessionárias; trechos concedidos x sob gestão direta; pedágio, free flow (Sistema de Livre Passagem), TAG, tarifa, reajuste.
- Execução orçamentária, empenho, restos a pagar, ritmo de investimento (Novo PAC, LOA) e contingenciamento/bloqueio; emendas parlamentares (RP6/RP9) direcionadas a trechos.
- Licitações, contratos, aditivos, medições, fiscalização de obras (supervisoras) e integridade (foco de TCU/CGU); RDC, contratação integrada, sobrepreço/superfaturamento.
- Licenciamento ambiental (IBAMA), desapropriações, passivos socioambientais, unidades de conservação, terras indígenas/quilombolas e travessias de fauna.
- Eventos climáticos extremos: enchentes, deslizamentos, quedas de barreira, rodovias interditadas e reconstrução (ex.: BRs do RS pós-enchentes de 2024; serras do Sudeste; BR-116 e BR-376).

**Principais RISCOS reputacionais típicos:**
- **Narrativa de "obra parada / atrasada / inacabada"** atribuída à gestão do DNIT, especialmente em duplicação de alto interesse regional.
- **Colapso ou interdição de OAE** (ponte/viaduto) com vítimas ou grave transtorno logístico → narrativa de negligência e falha de fiscalização estrutural.
- **Achados de controle** (acórdão do TCU, relatório da CGU) sobre sobrepreço, superfaturamento, medições indevidas, obra de baixa qualidade ou recomendação de paralisação cautelar.
- **Ação civil pública ou denúncia do MPF**, ou operação da Polícia Federal, sobre contratos, medições e execução.
- **Insegurança viária** (mortes em trecho federal) associada à ausência de manutenção, sinalização ou duplicação prometida.
- **Contingenciamento/baixa execução orçamentária e alto volume de restos a pagar** lidos como incapacidade de entrega.
- **Vácuo de responsável** (trecho é do DNIT, da concessionária/ANTT ou do DER?) gerando desgaste que recai sobre o órgão federal.
- **Politização da obra** (parlamentar cobra emenda não executada, oposição explora, disputa federativa com governador/prefeito) e captura da agenda em ano eleitoral.

**OPORTUNIDADES de posicionamento institucional:**
- Entregas concretas com dados verificáveis: inaugurações, quilômetros duplicados/recuperados, pontes concluídas, contornos entregues.
- Segurança viária como missão pública: redução de mortes em trecho federal, tratamento de pontos críticos, avanços do BR-Legal.
- Modernização e transparência: dados abertos, painel de obras, sistema de acompanhamento, tecnologia de monitoramento (drones, sensores), free flow como modernização.
- Resposta a desastres climáticos: reabertura rápida de rodovias, obras emergenciais e reconstrução como prova de capacidade operacional.
- Novo PAC e agenda de investimento como narrativa de "país que volta a construir e a manter".
- Integridade proativa: governança de contratos, resposta tempestiva e documentada a apontamentos do TCU/CGU, mutirões de fiscalização de medição.

**STAKEHOLDERS-chave e ÓRGÃOS reguladores/entidades relevantes (nomes concretos do setor brasileiro):**
- **Supervisão/formulação:** Ministério dos Transportes (e Secretaria Nacional de Transporte Rodoviário).
- **Executor rodoviário federal:** DNIT — Departamento Nacional de Infraestrutura de Transportes, sede e Superintendências Regionais (SRs) por unidade da federação.
- **Regulação de concessões e transporte terrestre:** ANTT — Agência Nacional de Transportes Terrestres.
- **Planejamento/estudos:** EPL/Infra S.A. (Empresa Brasileira de Participações em Energia Nuclear e Binacional/planejamento logístico — usar como fonte de estudos e projeções de projetos).
- **Órgãos de controle e apuração:** TCU (Tribunal de Contas da União) — inclusive relatoria e acórdãos com determinação de paralisação; CGU (Controladoria-Geral da União); MPF (Ministério Público Federal); Polícia Federal; AGU na defesa judicial.
- **Fiscalização de trânsito e dados de acidentes:** PRF — Polícia Rodoviária Federal (fonte primária de estatísticas de sinistralidade).
- **Ambiental:** IBAMA e órgãos estaduais de meio ambiente (licenciamento e embargos).
- **Poder Legislativo:** Congresso Nacional, com destaque para a Comissão de Infraestrutura (CI) e a Frente Parlamentar Mista de Logística e Infraestrutura no Senado, e a Comissão de Viação e Transportes (CVT) na Câmara; bancadas estaduais; risco de CPI, requerimentos de informação e convocação de dirigentes.
- **Setor privado e representação:** concessionárias de rodovias; ABCR (Associação Brasileira de Concessionárias de Rodovias); CNT (Confederação Nacional do Transporte, autora da Pesquisa CNT de Rodovias); construtoras e entidades como CBIC e Sinicon (Sindicato Nacional da Indústria da Construção Pesada).
- **Usuários e sociedade:** CNTA/entidades de caminhoneiros e do transporte rodoviário de cargas, ABRATI (transporte de passageiros), Observatório Nacional de Segurança Viária (ONSV), imprensa especializada (ex.: setoriais de logística) e local, e comunidades lindeiras às rodovias.
- **Federativos:** governos estaduais, DERs estaduais (em trechos delegados/convênios) e prefeituras em travessias urbanas e contornos.
$sector$
WHERE name = 'DNIT Rodoviária';

UPDATE clients SET report_prompt = $sector$
### INTELIGÊNCIA DE SETOR — INDÚSTRIA DE SOFTWARE DE MINAS GERAIS (contexto que você já domina e deve aplicar)

**Temas-âncora recorrentes do setor** (use como grade de leitura para classificar os sinais do corpus):
1. **Tributação de software e serviços de TI** — conflito histórico ISS (municipal) vs. ICMS (estadual) sobre software, pacificado pelo STF na ADIs 1.945 e 5.659 (2021), que definiu a incidência de ISS; a **Reforma Tributária (EC 132/2023) e sua regulamentação (LC 214/2025)**, com a transição para IBS/CBS entre 2026 e 2033, extinção de ISS/ICMS/PIS/COFINS, alíquota-padrão de referência estimada na casa dos 26,5%–28%, regime do **split payment**, tratamento do **Simples Nacional** (dilema do crédito para clientes) e ausência de regime específico favorecido para software — ponto sensível para o setor. Acompanhe ainda a **Lei do Bem (Lei 11.196/2005)**, a Lei de Informática/PPB e incentivos estaduais à inovação.
2. **Capital humano e déficit de talentos em TI** — o apagão de mão de obra (a Brasscom projeta demanda anual de centenas de milhares de profissionais frente a uma formação insuficiente), formação e requalificação (upskilling/reskilling), evasão de talentos para o exterior e para outros polos, papel das universidades mineiras (UFMG, PUC Minas, CEFET-MG, UFV, UFOP, UFJF, UNIFEI) e do Sistema S (SENAI, SEBRAE), além de programas como o antigo "Programemos" e iniciativas de formação em massa.
3. **Ecossistema de inovação e startups** — polos e hubs mineiros (**San Pedro Valley** em Belo Horizonte, **Santa Rita do Sapucaí — "Vale da Eletrônica"**, Inatel e ETE FMC, **BH-TEC**, o Parque Tecnológico de Belo Horizonte), venture capital, aceleradoras, scale-ups e unicórnios/cases mineiros (ex.: **Hotmart, Sankhya, Méliuz, Take Blip, Localiza&Co em mobilidade-tech**), e a interlocução com a ABStartups.
4. **Inteligência Artificial, cibersegurança e transformação digital** — adoção de IA generativa, regulação da IA (**PL 2338/2023**, aprovado no Senado e em tramitação na Câmara), LGPD e a atuação da **ANPD**, soberania e localização de dados, e o crescimento de incidentes de cibersegurança que pressionam o setor.
5. **Políticas públicas estaduais e competitividade regional** — atração de investimentos, benefícios fiscais estaduais e a guerra fiscal, agenda de governo digital de MG (Prodemge, Plano Mineiro de Desenvolvimento), comparação com polos concorrentes (**São Paulo; Florianópolis/SC — o "Vale do Silício brasileiro" e a ACATE; Recife/PE — Porto Digital; Ceará — Insight Data Science**).
6. **Representatividade institucional e agenda sindical patronal** — a Convenção Coletiva do setor de TI (relação com o **SINDPD-MG**, sindicato laboral, e negociação da data-base), enquadramento sindical (CNAE de desenvolvimento de software vs. serviços de TI), vinculação ao sistema **FIEMG/CNI**, e o protagonismo do {cliente} frente a entidades concorrentes ou complementares (ASSESPRO-MG, Softex, Fumsoft).

**Principais RISCOS reputacionais típicos do setor (para o SindInfor):**
- **Risco tributário-reputacional**: a regulamentação da reforma (LC 214/2025) tende a elevar a carga sobre software e serviços de TI intensivos em mão de obra (que têm poucos créditos a compensar); se o SindInfor for percebido como omisso, tardio ou tecnicamente frágil na defesa do setor junto ao Comitê Gestor do IBS e à SEF-MG, perde legitimidade junto às associadas. Risco simétrico: ser rotulado como "lobby por privilégio setorial" pela opinião pública fiscalista.
- **Risco de irrelevância/ofuscamento**: ser eclipsado por entidades nacionais de maior porte e voz consolidada (Brasscom, ABES, ASSESPRO Nacional, Softex) na cobertura da reforma e da regulação de IA, ficando restrito a um papel local e reativo.
- **Risco de descolamento das startups**: o discurso sindical patronal tradicional pode não dialogar com o ecossistema jovem organizado por hubs (San Pedro Valley) e pela ABStartups, gerando a percepção de "sindicato do software legado", distante de VC, scale-ups e do movimento das big techs.
- **Risco de captura por pauta polarizada**: temas como regulação de IA, regime de teletrabalho (Lei 14.442/2022) e tributação podem arrastar a entidade para embates político-partidários que fragilizam sua imagem técnica e suprapartidária.
- **Risco de exposição em capital humano**: se o "apagão de talentos" virar pauta negativa (empresas mineiras perdendo profissionais para SP, exterior e trabalho remoto para o Sul/Sudeste), o setor — e por extensão o SindInfor — será cobrado por soluções que não controla sozinho.
- **Risco de guerra fiscal e evasão de sedes**: perda de competitividade de MG frente a incentivos de SC, PE, SP e ES pode gerar a narrativa de "esvaziamento do polo mineiro" e migração de CNPJs.
- **Risco de crise setorial-vitrine**: um vazamento de dados relevante (LGPD/ANPD), fraude ou falha de fornecedor de software com sede em MG pode contaminar a reputação do setor e demandar posicionamento imediato da entidade.

**OPORTUNIDADES de posicionamento institucional típicas:**
- Assumir a **voz técnica autorizada sobre a reforma tributária aplicada ao software em MG** — traduzir a complexidade de IBS/CBS, split payment e transição 2026–2033 para as associadas e para o poder público estadual, com nota técnica e cartilha próprias.
- Posicionar o SindInfor como **ponte entre o software estabelecido e o ecossistema de startups/inovação** mineiro (San Pedro Valley, BH-TEC, Santa Rita do Sapucaí).
- Liderar a **agenda de capital humano** (formação, parcerias com UFMG/PUC Minas/CEFET-MG e Sistema S) como bandeira positiva e propositiva, com dados e metas.
- Ocupar espaço como **interlocutor do Governo de MG** (SEDE, SEF-MG, FAPEMIG, Prodemge) e da **ALMG** em competitividade, governo digital e atração de investimentos em tecnologia.
- Construir a narrativa de **Minas Gerais como polo de software relevante no Brasil**, disputando protagonismo com SP, SC e PE, ancorada em cases e números do próprio setor mineiro.

**STAKEHOLDERS-CHAVE e ÓRGÃOS/ENTIDADES relevantes (cite nomes concretos ao longo do relatório quando pertinente ao corpus):**
- **Entidades setoriais (nacionais e MG)**: ASSESPRO-MG e ASSESPRO Nacional, Brasscom, Softex, **Fumsoft** (Sociedade Mineira de Software), ABES (Associação Brasileira das Empresas de Software), ABStartups, Anprotec, SEPROSP (referência comparativa).
- **Sindicato laboral (contraparte na negociação)**: **SINDPD-MG** (Sindicato dos Trabalhadores em Processamento de Dados de MG).
- **Federação e sistema patronal**: **FIEMG** (Federação das Indústrias do Estado de Minas Gerais), CNI, SEBRAE-MG, SENAI, IEL.
- **Governo e poder público (MG e federal)**: Governo de Minas Gerais, **Secretaria de Estado de Desenvolvimento Econômico (SEDE-MG)**, **Secretaria de Estado de Fazenda de MG (SEF-MG)**, **FAPEMIG**, **Prodemge** (Companhia de TI do Estado), **Assembleia Legislativa de MG (ALMG)** e sua Comissão de Ciência e Tecnologia, Prefeitura de Belo Horizonte, Ministério da Fazenda, MDIC, **Ministério da Ciência, Tecnologia e Inovação (MCTI)**, Receita Federal, **Comitê Gestor do IBS**.
- **Regulação e afins**: **ANPD** (LGPD), Congresso Nacional (regulamentação complementar da reforma tributária e tramitação do PL 2338/2023 de IA), CONFAZ, STF (jurisprudência tributária sobre software).
- **Ecossistema de inovação**: San Pedro Valley, BH-TEC/Parque Tecnológico de BH, Inatel e ETE FMC (Santa Rita do Sapucaí), aceleradoras e fundos de VC atuantes em MG.
- **Academia**: UFMG, PUC Minas, CEFET-MG, UFV, UFOP, UFJF, UNIFEI.
- **Empresas-referência mineiras**: quando citadas no corpus (ex.: Hotmart, Sankhya, Méliuz, Take Blip), trate como termômetro do setor, não como sujeito do relatório.
$sector$
WHERE name = 'SindInfor';
