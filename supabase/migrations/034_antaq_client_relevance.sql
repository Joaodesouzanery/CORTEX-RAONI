-- 034: onboarding da ANTAQ (Agência Nacional de Transportes Aquaviários).
--
-- Idempotente. Dividida em dois blocos por uma razão operacional:
--
--   BLOCO A — fontes. Não depende da linha do cliente; pode rodar a qualquer
--             momento.
--   BLOCO A2 — a linha do cliente e seus vínculos temáticos.
--   BLOCO B — regras, textos, agenda e perfil editorial.
--
-- A migration é AUTOSSUFICIENTE: cria o cliente se ele não existir. A versão
-- anterior exigia criá-lo antes pela UI e abortava com RAISE EXCEPTION — o que
-- apenas transformava um passo esquecido num erro no SQL Editor.
--
-- O contrato com a UI: `syncClientThematicSources` (src/lib/client-sources.ts)
-- apaga e reconstrói TODOS os vínculos com is_thematic = true a partir de
-- `clients.feed_names` a cada POST/PUT de cliente. Por isso o A2 escreve
-- `feed_names` E materializa `client_sources` com a MESMA projeção que o sync
-- calcularia — assim o primeiro save na UI é no-op, não uma mudança.
--
-- MECÂNICA DO MATCHER QUE CONDICIONA TODO O DESENHO ABAIXO — leia antes de editar:
--
--  1. `excluded_terms` veta o DOCUMENTO INTEIRO, incluindo `content`
--     (client-relevance.ts: articleText concatena título+excerpt+corpo). Com
--     corpo integral, uma palavra corrente como "aeroporto" ou "dragagem" vira
--     interruptor de desligar. Exclusão só para expressão RARA e desambiguadora.
--  2. "ANTAQ" NÃO é sigla para o parser: classifyKeyword exige <= 4 letras
--     (relevance.ts). São 5 → é `word`, casa case-insensitive, portanto casa
--     "Antaq", a grafia dominante no gov.br e no Google News.
--  3. O casamento é por TOKEN. `porto` cru casaria Porto Alegre, Porto Velho e
--     Porto Seguro; `berço` casaria "berço esplêndido". Por isso o vocabulário
--     usa adjetivo ("portuário"), termo composto ("porto organizado") ou nome
--     completo ("Porto de Santos").
--  4. Só o ÚLTIMO token de uma frase tolera plural. "estação de transbordo de
--     carga" não casa o plural — semeie as duas formas.
--
-- VOCABULÁRIO BANIDO, com o motivo (não "corrija" isto depois):
--   ETC  — sigla de 3 letras; a guarda vira "o documento contém ETC maiúsculo",
--          disparando em qualquer manchete caixa-alta. Use a frase por extenso.
--   MPA  — colide com Movimento dos Pequenos Agricultores. Só na R7, sob AND e
--          com veto explícito.
--   PGO  — colide com o Plano Geral de Outorgas da Anatel (telecom).
--   calado / armador — homógrafos ("ficou calado", armador de basquete).
--   porto / berço nus — ver (3).
--   números de lei — normalizeText('R$ 12.815,00') tokeniza ['r','12','815','00'],
--          logo "12.815" casa valor monetário. Base legal vai só no report_prompt.
--
-- SEPARAÇÃO COM O CLIENTE DAQ — DIRETORIA DE INFRAESTRUTURA AQUAVIÁRIA/DNIT:
-- a regra 'infraestrutura aquaviária' do DAQ (025, peso 4) é um OR simples que
-- já dispara em QUALQUER matéria hidroviária, sem exigir DNIT. A separação é
-- feita por assimetria de competência, NÃO por veto:
--   obra física da via  -> DAQ  (dragagem, derrocamento, eclusa, balizamento)
--   serviço regulado    -> ANTAQ (outorga, arrendamento, tarifa, cabotagem)
--   zona compartilhada  -> ambos, legitimamente (concessão de hidrovia, canal)
-- Deliberadamente NÃO alteramos nenhuma regra do DAQ: excluir vocabulário da
-- ANTAQ lá criaria falso negativo pior que a sobreposição.
-- Cobertura de teste: describe('ANTAQ × DAQ') em src/lib/client-relevance.test.ts.

-- ===========================================================================
-- BLOCO A — fontes
-- ===========================================================================

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  (
    'Institucional — ANTAQ (menção direta)',
    'https://news.google.com/rss/search?q=%22ANTAQ%22%20OR%20%22Ag%C3%AAncia%20Nacional%20de%20Transportes%20Aquavi%C3%A1rios%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 100, 'institucional', 'publico'
  ),
  (
    'Google News — ANTAQ/Regulação Portuária',
    'https://news.google.com/rss/search?q=%22arrendamento%20portu%C3%A1rio%22%20OR%20%22leil%C3%A3o%20de%20arrendamento%22%20OR%20%22outorga%20portu%C3%A1ria%22%20OR%20%22terminal%20de%20uso%20privado%22%20OR%20%22autoridade%20portu%C3%A1ria%22%20OR%20%22tarifa%20portu%C3%A1ria%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 95, 'imprensa', 'publico'
  ),
  -- Não-temática de propósito: cabotagem é setorial e deve pontuar por regra,
  -- não pelo +1 de feed. O -"cabotagem aérea" na própria consulta é a primeira
  -- linha de defesa; as excluded_terms das regras R3/R4 são a segunda.
  (
    'Google News — Cabotagem e Marinha Mercante',
    'https://news.google.com/rss/search?q=%28cabotagem%20OR%20%22BR%20do%20Mar%22%20OR%20%22marinha%20mercante%22%20OR%20afretamento%20OR%20praticagem%29%20-%22cabotagem%20a%C3%A9rea%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 90, 'imprensa', 'publico'
  ),
  -- O feed direto portosenavios.com.br/feed devolve 403; via Google News funciona.
  (
    'Portos e Navios — referência',
    'https://news.google.com/rss/search?q=site%3Aportosenavios.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 85, 'imprensa', 'referencia'
  )
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name, type = EXCLUDED.type, active = TRUE,
  is_general = EXCLUDED.is_general, priority = EXCLUDED.priority,
  categoria = EXCLUDED.categoria, access_mode = EXCLUDED.access_mode;

-- ===========================================================================
-- BLOCO A2 — a linha do cliente e os vínculos temáticos
-- ===========================================================================

-- Criar SÓ se não existir nenhum cliente com prefixo ANTAQ.
-- Um `ON CONFLICT (name) DO NOTHING` puro não bastaria: se o operador já criou
-- "ANTAQ — Agência Nacional de Transportes Aquaviários" pela UI, inserir
-- 'ANTAQ' criaria uma SEGUNDA linha, e todo `WHERE name LIKE 'ANTAQ%'` abaixo
-- passaria a casar as duas.
-- O nome precisa começar por "ANTAQ": `sourceRequiresContext`
-- (src/lib/client-relevance.ts) e `aliasesFor` (src/lib/monthly-editions.ts)
-- usam startsWith('ANTAQ'). `name` é a única coluna NOT NULL sem default.
INSERT INTO clients (name, sector, contratante, active)
SELECT 'ANTAQ', 'Transporte aquaviário, portos e hidrovias', 'CORTEX', TRUE
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name LIKE 'ANTAQ%')
ON CONFLICT (name) DO NOTHING;

-- `feed_names` por UNIÃO, nunca por substituição: as escolhas do curador
-- sobrevivem a uma re-execução desta migration.
-- Os dois nomes têm de ser byte-idênticos aos de `sources.name` do Bloco A —
-- travessão (—), não hífen. Essa igualdade de string é todo o contrato com
-- `syncClientThematicSources`.
UPDATE clients SET
  active = TRUE,
  feed_names = ARRAY(SELECT DISTINCT x FROM unnest(
    COALESCE(feed_names, ARRAY[]::TEXT[]) ||
    ARRAY['Institucional — ANTAQ (menção direta)',
          'Google News — ANTAQ/Regulação Portuária']) AS x)
WHERE name LIKE 'ANTAQ%';

-- Materializa os vínculos temáticos agora. Sem isto, o bônus de +1 por fonte
-- temática (client-relevance.ts) não existiria até alguém abrir e salvar o
-- cliente na UI. A projeção é a mesma de syncClientThematicSources
-- (priority || 50, is_thematic = true), então o próximo save é no-op.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT c.id, s.id, COALESCE(s.priority, 50), TRUE
FROM clients c
CROSS JOIN LATERAL unnest(COALESCE(c.feed_names, ARRAY[]::TEXT[])) AS f(name)
JOIN sources s ON s.name = f.name
WHERE c.name LIKE 'ANTAQ%'
ON CONFLICT (client_id, source_id) DO UPDATE
  SET is_thematic = TRUE, priority = EXCLUDED.priority;

-- ===========================================================================
-- BLOCO B — regras, textos, agenda e perfil editorial
-- ===========================================================================

-- --------------------------------------------------------------------------
-- B1 — textos do cliente
-- --------------------------------------------------------------------------

UPDATE clients SET
  sector = COALESCE(NULLIF(sector, ''), 'Transporte aquaviário, portos e hidrovias'),
  context = $ctx$A ANTAQ é a agência reguladora federal do transporte aquaviário, criada pela Lei 10.233/2001 e vinculada ao Ministério de Portos e Aeroportos. Regula, outorga e fiscaliza a navegação fluvial, lacustre e de travessia; a navegação de apoio marítimo, de apoio portuário, de cabotagem e de longo curso; os portos organizados e as instalações portuárias neles localizadas; os terminais de uso privado (TUP); as estações de transbordo de carga; as instalações portuárias públicas de pequeno porte (IP4) e as instalações portuárias de turismo. Sua reputação repousa sobre previsibilidade regulatória, isonomia entre agentes e capacidade de entregar leilões e outorgas no prazo. NÃO executa obras — infraestrutura hidroviária física é do DNIT (DAQ); segurança da navegação é da Marinha/DPC; formulação de política é do MPA. Toda leitura deve preservar essa fronteira de competência.$ctx$,
  -- keywords alimentam os ALERTAS, que fazem OR puro sobre título+excerpt e
  -- SEM a guarda de sigla do client-relevance. Por isso só termos precisos.
  -- "hidrovia" fica fora de propósito: duplicaria o alerta do DAQ.
  keywords = ARRAY[
    'ANTAQ',
    'Agência Nacional de Transportes Aquaviários',
    'arrendamento portuário',
    'leilão de arrendamento',
    'outorga portuária',
    'terminal de uso privado',
    'porto organizado',
    'autoridade portuária',
    'cabotagem',
    'BR do Mar',
    'marinha mercante',
    'praticagem',
    'navegação interior',
    'transporte aquaviário',
    'tarifa portuária',
    'Ministério de Portos e Aeroportos',
    'estatísticas aquaviárias',
    'sobreestadia'
  ]::TEXT[],
  synonyms = $syn$arrendamento portuário, leilão portuário, concessão portuária, desestatização portuária, relicitação
terminal de uso privado, estação de transbordo de carga, instalação portuária pública de pequeno porte
cabotagem, navegação de cabotagem, navegação de longo curso, apoio marítimo, apoio portuário
empresa brasileira de navegação, afretamento, marinha mercante
hidrovia, navegação interior, via navegável, transporte hidroviário, canal de acesso
praticagem, sobreestadia, demurrage, granel sólido, granel líquido, terminal de contêineres
agenda regulatória, tomada de subsídios, resolução normativa, sandbox regulatório, análise de impacto regulatório$syn$
WHERE name LIKE 'ANTAQ%';

UPDATE clients SET report_prompt = $sector$## INTELIGÊNCIA DE SETOR — REGULAÇÃO DO TRANSPORTE AQUAVIÁRIO E DOS PORTOS (BRASIL)

Use este repertório como lente obrigatória de análise; não o transcreva. A ANTAQ é **agência reguladora federal**, criada pela Lei 10.233/2001, submetida à Lei das Agências Reguladoras (13.848/2019), com diretoria colegiada ampliada de três para cinco membros pela Lei 14.465/2022 e vinculada ao Ministério de Portos e Aeroportos (MPA). Regula, **não executa**: outorga, fiscaliza, define regras tarifárias e arbitra conflitos. Toda leitura reputacional parte dessa natureza — cobranças que a confundam com executor de obra (DNIT/DAQ), com formulador de política (MPA/Casa Civil), com autoridade de segurança da navegação (Marinha/DPC) ou com a própria Autoridade Portuária são, em si, risco de enquadramento a ser corrigido.

**Esfera de atuação (termos oficiais).** Navegação fluvial, lacustre e de travessia; navegação de apoio marítimo, de apoio portuário, de cabotagem e de longo curso; portos organizados e as instalações portuárias neles localizadas; terminais de uso privado (TUP); estações de transbordo de carga; instalações portuárias públicas de pequeno porte (IP4); instalações portuárias de turismo. Marco portuário: Lei 12.815/2013 e Decreto 8.033/2013. Cabotagem: BR do Mar (Lei 14.301/2022) e a figura da empresa brasileira de navegação (EBN).

**Temas-âncora recorrentes.**
- **Outorgas e arrendamentos portuários** — leilões de arrendamento, chamadas públicas, autorizações de TUP, relicitação e prorrogação antecipada; carteira superior a R$30 bi em novos contratos.
- **Agenda Regulatória 2025-2028** — revisão ordinária, tomadas de subsídios, consultas e audiências públicas, análise de impacto regulatório, sandbox regulatório, normatização de "Serviço Adequado", padronização da estrutura de serviços de terminais de contêineres.
- **Concessões de canais e sistemas aquaviários** — canal de acesso do Porto de Santos, canal de Itajaí/SC, SAIP Sul-Mirim (acessos a Rio Grande, Pelotas e Porto Alegre, Lagoa dos Patos, Lago Guaíba, rios Jacuí, Caí, dos Sinos e Gravataí), leilão do Porto de São Sebastião/SP, arrendamento PAR05 em Paranaguá (granéis sólidos).
- **Hidrovias em estudo de concessão (PGO 2023)** — Madeira, Tapajós, Tocantins-Araguaia, Paraguai, Barra Norte ("Hidrovia Verde") e Lagoa Mirim; também Tietê-Paraná. Horizonte do PNL 2050.
- **Cabotagem e marinha mercante** — regulamentação do BR do Mar, afretamento, competitividade frente ao rodoviário, descarbonização do modal.
- **Regras tarifárias e serviços em porto** — tarifas de porto organizado e de afretamento, praticagem, sobreestadia (demurrage), THC, isonomia entre arrendatárias e TUPs.
- **Estatísticas Aquaviárias** — produto de dados da própria agência e base do debate público sobre movimentação de cargas; sua credibilidade é ativo reputacional.
- **Harmonização institucional** — grupo de trabalho do MPA para alinhar regras de concessões de portos, aeroportos e hidrovias com a ANAC.

**Riscos reputacionais típicos.**
- **Atraso e insegurança jurídica** — leilões adiados, editais impugnados, liminares e determinações do TCU que travam certames; narrativa de "agência que não entrega".
- **Captura ou assimetria** — acusação de favorecimento de arrendatárias frente a TUPs (ou o inverso), de operadores frente a embarcadores, de praticagem frente a armadores.
- **Preços e abusos em cadeia** — sobreestadia, THC, "taxa de seca" na Amazônia; a agência é cobrada como se fosse controladora de preços.
- **Vácuo de competência** — episódios em que a fronteira ANTAQ / DNIT / MPA / Marinha-DPC / ANA / autoridades portuárias produz "ninguém é responsável".
- **Governança da agência** — mandatos vencidos, diretoria desfalcada, indicações e sabatinas travadas, quórum e autonomia. **Não personalize: a composição da diretoria é volátil; cite nomes apenas quando aparecerem no corpus do mês.**
- **Qualidade do dado** — contestação das Estatísticas Aquaviárias corrói o principal ativo técnico.

**Oportunidades de posicionamento.** Agência que destrava investimento privado em infraestrutura com previsibilidade; guardiã da isonomia competitiva no porto; produtora de estatística pública confiável; indutora da cabotagem como modal de menor emissão; parceira técnica do MPA na harmonização regulatória multimodal.

**Stakeholders a nomear quando aparecerem.** MPA e Secretaria Nacional de Portos e Transportes Aquaviários; Casa Civil/PPI; DNIT e sua Diretoria de Infraestrutura Aquaviária (DAQ) — executor, não regulador; Marinha do Brasil/DPC, Tribunal Marítimo e Capitanias; ANA; ANAC e ANTT; TCU, CGU e MPF; Comissões de Infraestrutura do Senado e de Viação e Transportes da Câmara; autoridades portuárias (Portos de Santos S.A., Portos do Paraná, EMAP, Portos RS, SCPar); ABTP, ABTRA, Abratec, ABANI e CONAPRA; armadores e EBNs; embarcadores e o agronegócio; imprensa especializada (Portos e Navios, Portogente, Agência Infra, Eixos, Diário do Transporte) e econômica (Valor, Folha, Estadão, NeoFeed).$sector$
WHERE name LIKE 'ANTAQ%';

-- --------------------------------------------------------------------------
-- B2 — regras de relevância (client_relevance_rules não tem UI)
-- Escala: `direta` OU score >= 5 -> confirmado; >= 3 -> candidato; > 0 -> revisao.
-- Fonte temática vinculada soma +1.
-- --------------------------------------------------------------------------

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, seed.label, seed.match_type, seed.required_groups::JSONB, seed.excluded_terms::TEXT[],
       seed.weight, 1
FROM clients
CROSS JOIN (VALUES
  -- R1. Se a agência é nomeada, a matéria é dela. Zero exclusões, mesmo
  -- contrato de ONS/CCEE/PRIO. Sem alias sem acento: normalizeText desacentua
  -- os dois lados, seria redundante.
  (
    'menção direta à ANTAQ', 'direta',
    '[["ANTAQ","Agência Nacional de Transportes Aquaviários"]]',
    '{}', 8
  ),
  -- R2. Núcleo da competência. O G1 (ato) PODE ser genérico porque o G2
  -- (objeto) é estritamente portuário: nenhum termo do G2 casa "Porto Alegre"
  -- e "arrendamento rural" não convive com "autoridade portuária". É a
  -- inversão do rascunho anterior, que tinha G1 estreito e G2 perigoso.
  -- Zero exclusões: o AND já é o filtro, e foi excluir "aeroporto" que matou
  -- a pauta do Ministério de Portos e AEROPORTOS.
  (
    'outorgas, arrendamentos e leilões portuários', 'setorial',
    '[["outorga","outorgas","arrendamento","arrendamentos","leilão","leilões","concessão","concessões","licitação","edital","chamada pública","desestatização","relicitação","prorrogação antecipada","PAR05"],
      ["porto organizado","portos organizados","autoridade portuária","instalação portuária","instalações portuárias","terminal portuário","terminais portuários","terminal de uso privado","terminais de uso privado","TUP","arrendatária","setor portuário","Porto de Santos","Porto de Paranaguá","Porto de Itajaí","Porto de São Sebastião","Porto do Rio Grande","Porto de Suape","Porto do Itaqui","Porto de Pecém"]]',
    '{}', 4
  ),
  -- R3. "portuário"/"aquaviário" são adjetivos sem falso-amigo em português —
  -- âncoras seguras. As duas exclusões existem porque `cabotagem` está no G2;
  -- são expressões RARAS, logo seguras como veto de documento inteiro.
  (
    'atos regulatórios e tarifários do setor aquaviário', 'setorial',
    '[["resolução normativa","norma regulatória","agenda regulatória","tomada de subsídios","consulta pública","audiência pública","análise de impacto regulatório","sandbox regulatório","regras tarifárias","tarifa portuária","tarifas portuárias","revisão tarifária","reajuste tarifário","marco regulatório","serviço adequado","autorização de funcionamento","auto de infração","termo de ajustamento de conduta"],
      ["portuário","portuária","aquaviário","aquaviária","cabotagem","navegação interior","porto organizado","autoridade portuária","terminal de uso privado","praticagem","afretamento","marinha mercante","apoio marítimo","apoio portuário","transporte aquaviário"]]',
    '{"cabotagem aérea","aeronautas"}', 4
  ),
  -- R4. OR simples justificado: é vocabulário de competência EXCLUSIVA da
  -- ANTAQ (o DNIT não tem nada com cabotagem). "navegação de longo curso" e
  -- não "longo curso" nu, que casaria "no longo curso da história".
  -- `armador` fora: armador de basquete, armador de ferragem.
  (
    'cabotagem, navegação e marinha mercante', 'setorial',
    '[["cabotagem","BR do Mar","navegação de cabotagem","navegação de longo curso","marinha mercante","empresa brasileira de navegação","empresas brasileiras de navegação","afretamento","afretamento de embarcação","apoio marítimo","apoio portuário","navegação de travessia","navegação lacustre","transporte marítimo de cargas"]]',
    '{"cabotagem aérea","aeronautas","cabotagem aeroviária"}', 3
  ),
  -- R5. A regra que separa da obra do DNIT — POSITIVAMENTE, pelo AND com
  -- moldura regulatória, e NÃO por veto. O rascunho anterior excluía
  -- dragagem/derrocagem/eclusa aqui, o que matava a regra exatamente nas
  -- concessões de R$30bi+, porque toda modelagem descreve dragagem no escopo.
  --   "DNIT conclui dragagem no Madeira"            -> só DAQ.
  --   "Edital da concessão da hidrovia do Tocantins" -> ambos, corretamente.
  (
    'hidrovias e navegação interior sob ótica regulatória', 'setorial',
    '[["hidrovia","hidrovias","hidroviário","hidroviária","navegação interior","navegação fluvial","via navegável","vias navegáveis","transporte hidroviário","Hidrovia do Madeira","Hidrovia do Tapajós","Tocantins-Araguaia","Paraguai-Paraná","Tietê-Paraná","Lagoa Mirim","Hidrovia Verde","Sul-Mirim","SAIP","canal de acesso"],
      ["outorga","outorgas","concessão","concessões","autorização","permissão","tarifa","pedágio hidroviário","consulta pública","audiência pública","agenda regulatória","marco regulatório","Plano Geral de Outorgas","estudo de viabilidade","EVTEA","leilão","edital","modelagem","PNL 2050"]]',
    '{}', 3
  ),
  -- R6. Rede de segurança setorial, peso 2 DELIBERADO: sozinha rende
  -- `revisao`/baixa — aparece na fila de curadoria e não entra no relatório.
  -- Mesmo papel do peso 2 de "transição energética" no ONS. Combinada com
  -- R2/R3 chega a 6 e confirma.
  -- ETC ausente por decisão: a competência entra pela frase, nas duas formas.
  (
    'portos, terminais e movimentação de cargas', 'setorial',
    '[["porto organizado","portos organizados","autoridade portuária","setor portuário","instalação portuária","instalações portuárias","terminal de uso privado","terminais de uso privado","estação de transbordo de carga","estações de transbordo de carga","instalação portuária pública de pequeno porte","movimentação portuária","movimentação de cargas","estatísticas aquaviárias","sobreestadia","demurrage","praticagem","berço de atracação","terminal de contêineres","terminais de contêineres","granel sólido","granel líquido","instalação portuária de turismo","calado operacional","profundidade do canal"]]',
    '{}', 2
  ),
  -- R7. Único lugar onde a sigla MPA existe, e só sob AND com contexto
  -- portuário MAIS veto explícito ao Movimento dos Pequenos Agricultores.
  -- Não contém "ANTAQ" no G2 de propósito: a R1 já confirmou; repetir só
  -- inflaria o score e poluiria o `tema`.
  -- Se houver ruído no primeiro ciclo, esta é a PRIMEIRA regra a desativar.
  (
    'política portuária federal (MPA)', 'setorial',
    '[["Ministério de Portos e Aeroportos","Secretaria Nacional de Portos e Transportes Aquaviários","Secretaria Nacional de Portos","MPA"],
      ["porto organizado","portuário","portuária","aquaviário","aquaviária","hidrovia","hidrovias","cabotagem","navegação interior","arrendamento","outorga","concessão","terminal de uso privado","praticagem"]]',
    '{"Movimento dos Pequenos Agricultores"}', 3
  )
) AS seed(label, match_type, required_groups, excluded_terms, weight)
WHERE clients.name LIKE 'ANTAQ%'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type,
  required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight,
  version = EXCLUDED.version,
  active = TRUE,
  updated_at = NOW();

-- --------------------------------------------------------------------------
-- B3 — perfil editorial
-- Semeado EXPLICITAMENTE porque o ELSE do seed da 030 é o perfil do DAQ
-- (["infraestrutura aquaviária","hidrovias","navegação"]); se a 030 reexecutar
-- depois da ANTAQ existir, ela herdaria os eixos do cliente errado.
-- Eixos CURTOS de propósito: deriveProvisionalTopics (monthly-agenda.ts)
-- transforma cada eixo num tópico casado por substring — um eixo longo nunca
-- apareceria literalmente e renderia tópico vazio.
-- --------------------------------------------------------------------------

INSERT INTO client_editorial_profiles
  (client_id, permanent_axes, inclusion_guidelines, exclusion_guidelines, style_guidelines, default_posture)
SELECT id,
  '["setor portuário","navegação interior","cabotagem","regulação aquaviária","outorgas e arrendamentos"]'::JSONB,
  COALESCE(context, ''),
  'Excluir coincidências lexicais com topônimos ("Porto Alegre", "Porto Velho", "Porto Seguro"), cabotagem aérea, turismo de cruzeiro sem recorte de instalação portuária, obra física de hidrovia sem ato regulatório associado (competência do DNIT/DAQ) e cobertura de mercado sem impacto setorial demonstrável.',
  COALESCE(report_prompt, ''),
  'consultivo_cauteloso'
FROM clients WHERE name LIKE 'ANTAQ%'
ON CONFLICT (client_id) DO UPDATE SET
  permanent_axes = EXCLUDED.permanent_axes,
  inclusion_guidelines = EXCLUDED.inclusion_guidelines,
  exclusion_guidelines = EXCLUDED.exclusion_guidelines,
  style_guidelines = EXCLUDED.style_guidelines,
  updated_at = NOW();

INSERT INTO client_editorial_profile_versions (client_id, version, snapshot)
SELECT client_id, version,
  jsonb_build_object(
    'permanent_axes', permanent_axes,
    'inclusion_guidelines', inclusion_guidelines,
    'exclusion_guidelines', exclusion_guidelines,
    'style_guidelines', style_guidelines,
    'default_posture', default_posture,
    'active', active
  )
FROM client_editorial_profiles
WHERE client_id IN (SELECT id FROM clients WHERE name LIKE 'ANTAQ%')
ON CONFLICT (client_id, version) DO NOTHING;

-- --------------------------------------------------------------------------
-- B4 — agenda mensal
-- TODOS com required = FALSE no primeiro ciclo. Quatro obrigatórios num
-- cliente sem histórico é o caminho mais curto para a triagem travar num mês
-- magro (uncoveredRequiredTopics bloqueia o fechamento). Promova 1-4 para
-- required = true depois de fechar a primeira edição.
-- Atenção: topicMatchesArticle casa por SUBSTRING, não por token — por isso
-- nada de "porto" solto aqui (casaria "aeroporto").
-- --------------------------------------------------------------------------

INSERT INTO client_report_topic_templates
  (client_id, position, title, rationale, inclusion_terms, exclusion_terms, required)
SELECT id, seed.position, seed.title, seed.rationale,
       seed.inclusion_terms::JSONB, seed.exclusion_terms::JSONB, FALSE
FROM clients
CROSS JOIN (VALUES
  (1, 'Outorgas, arrendamentos e leilões portuários',
      'Núcleo da competência: certames, editais, autorizações de TUP e a carteira de novos contratos.',
      '["arrendamento portuário","leilão de arrendamento","outorga portuária","concessão portuária","terminal de uso privado","desestatização portuária","edital de arrendamento","relicitação","PAR05","Porto de São Sebastião","Porto de Paranaguá"]',
      '["cabotagem aérea"]'),
  (2, 'Concessões de hidrovias e canais de acesso',
      'Modelagem, consultas e leilões de vias e acessos aquaviários — fronteira com o DNIT executor.',
      '["canal de acesso","concessão de hidrovia","SAIP","Sul-Mirim","Hidrovia do Madeira","Hidrovia do Tapajós","Tocantins-Araguaia","Paraguai-Paraná","Lagoa Mirim","Hidrovia Verde","pedágio hidroviário","Plano Geral de Outorgas"]',
      '[]'),
  (3, 'Cabotagem, BR do Mar e marinha mercante',
      'Competitividade e regulamentação do modal de cabotagem e do afretamento.',
      '["cabotagem","BR do Mar","marinha mercante","empresa brasileira de navegação","afretamento","navegação de longo curso","apoio marítimo","apoio portuário"]',
      '["cabotagem aérea","aeronautas"]'),
  (4, 'Agenda regulatória, tarifas e fiscalização',
      'Consultas, audiências, normas, regras tarifárias e atos sancionadores da agência.',
      '["agenda regulatória","tomada de subsídios","consulta pública","audiência pública","resolução normativa","sandbox regulatório","tarifa portuária","regras tarifárias","análise de impacto regulatório","serviço adequado","auto de infração"]',
      '[]'),
  (5, 'Desempenho do setor: cargas, contêineres e navegação interior',
      'Estatísticas Aquaviárias, movimentação e gargalos operacionais em porto e via.',
      '["estatísticas aquaviárias","movimentação portuária","movimentação de cargas","navegação interior","granel sólido","granel líquido","terminal de contêineres","sobreestadia","demurrage","praticagem"]',
      '[]'),
  (6, 'Institucionalidade da agência e política portuária federal',
      'Governança colegiada, autonomia, orçamento e a agenda do MPA/Secretaria Nacional.',
      '["Ministério de Portos e Aeroportos","Secretaria Nacional de Portos","agência reguladora","diretoria colegiada","autonomia regulatória","orçamento da agência","sabatina"]',
      '["Movimento dos Pequenos Agricultores"]')
) AS seed(position, title, rationale, inclusion_terms, exclusion_terms)
WHERE clients.name LIKE 'ANTAQ%'
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------------------------
-- B5 — fontes de referência, NÃO temáticas
-- Só as duas do Bloco A2 entram em clients.feed_names, porque feed_names
-- dispara ao mesmo tempo o +1 na classificação E o OR puro do digest de
-- alertas. As demais existem como sources e são vinculadas com
-- is_thematic = false, ou nem são vinculadas (as generalistas já são varridas).
-- --------------------------------------------------------------------------

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 70, FALSE
FROM clients client
CROSS JOIN sources source
WHERE client.name LIKE 'ANTAQ%'
  AND source.name IN (
    'Google News — Cabotagem e Marinha Mercante',
    'Portos e Navios — referência',
    'Valor Econômico — referência',
    'Folha de S.Paulo — referência',
    'Agência iNFRA',
    'Eixos'
  )
  -- Nunca rebaixar para não-temática uma fonte que o A2 acabou de vincular,
  -- nem uma que o curador pôs em feed_names.
  AND NOT (source.name = ANY(COALESCE(client.feed_names, ARRAY[]::TEXT[])))
ON CONFLICT (client_id, source_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- PÓS-CONDIÇÃO
-- O guard que existia no topo abortava a migration. Aqui ele vira verificação
-- de saída: preserva a intenção original — esta migration NUNCA pode ser um
-- no-op silencioso, porque `client_relevance_rules` não tem UI e ninguém
-- perceberia até o relatório sair vazio — sem impedir a execução.
-- Mensagem em ASCII (o SQL Editor renderiza mal acento em RAISE) e %% para
-- escapar o literal de porcentagem.
-- --------------------------------------------------------------------------
DO $$
DECLARE n_cli INT; n_rules INT; n_tematicas INT;
BEGIN
  SELECT count(*) INTO n_cli FROM clients WHERE name LIKE 'ANTAQ%';
  SELECT count(*) INTO n_rules FROM client_relevance_rules r
    JOIN clients c ON c.id = r.client_id WHERE c.name LIKE 'ANTAQ%';
  SELECT count(*) INTO n_tematicas FROM client_sources cs
    JOIN clients c ON c.id = cs.client_id WHERE c.name LIKE 'ANTAQ%' AND cs.is_thematic;

  IF n_cli <> 1 THEN
    RAISE EXCEPTION '034: esperava exatamente 1 cliente ANTAQ%%, encontrei %. Renomeie ou remova a duplicata antes de rodar de novo.', n_cli;
  END IF;
  IF n_rules < 7 THEN
    RAISE EXCEPTION '034: esperava 7 regras de relevancia, encontrei %.', n_rules;
  END IF;
  IF n_tematicas < 2 THEN
    RAISE EXCEPTION '034: esperava 2 fontes tematicas vinculadas, encontrei %. Verifique se o BLOCO A criou as fontes com o nome exato (travessao, nao hifen).', n_tematicas;
  END IF;
END $$;
