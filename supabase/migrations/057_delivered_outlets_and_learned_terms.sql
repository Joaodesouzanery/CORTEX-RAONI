-- 057: fontes dos veículos que chegaram ao cliente e termos aprendidos dos
-- relatórios de outubro (entregues, refeitos e destaques recebidos em 08/11).
--
-- Fontes. docs/fontes/faltantes.md (scripts/diff-outlets.mjs) mediu: de 259
-- veículos citados no que foi entregue de junho a outubro, 168 não tinham
-- fonte. São quase todos de cauda longa (1 a 5 menções) e sem RSS conhecido.
-- Em vez de um feed por portal — cada um mais uma fonte no lote do botão —
-- entra UMA busca por cliente, restrita a esses domínios (site:) e aos termos
-- do cliente, no mesmo formato da 051. O link do Google News é resolvido pelo
-- passo "Resolve Google News links" do fetch-news.
-- Brasil Energia (19 menções) segue fora: feed 403 e sem itens no Google
-- News (docs/fontes-bloqueadas.md). Canal Energia e Cenário Energia já tinham
-- fonte. NÃO testado desta sessão: a rede do ambiente bloqueia os sites; a
-- primeira coleta mostra em Fontes se alguma busca vem vazia ou com erro.
--
-- Termos. Regras novas com rótulo "aprendido:", "porta-voz:", "dirigente:" ou
-- "diretor:", para ficarem fáceis de achar e desligar. Termos ambíguos exigem
-- contexto num segundo grupo: Magnetita/Hematita também são minério de ferro,
-- Frade é palavra comum, COBRE é metal, SSE é sigla de muita coisa.
-- Exclusões da PRIO (PetroRecôncavo, Brava) só nas regras de setor: matéria
-- que compara as petroleiras e cita a PRIO pelo nome continua entrando.
--
-- Temas. Eixos dos destaques recebidos pelos clientes em outubro
-- (docs/referencia-relatorios/2026-10-destaques/). Os pedidos extras do dono
-- (novo governo, Cleitinho, marcos legais) já estão na 048.
--
-- Idempotente: pode colar mais de uma vez.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Google News — ONS nos veículos dos relatórios (energia)', 'https://news.google.com/rss/search?q=%28site%3Acanalsolar.com.br%20OR%20site%3Aem.com.br%20OR%20site%3Aplurale.com.br%20OR%20site%3Ajc.uol.com.br%20OR%20site%3Arevistamundoeletrico.com.br%20OR%20site%3Aveja.abril.com.br%29%20%28ONS%20OR%20%22Operador%20Nacional%20do%20Sistema%22%20OR%20%22setor%20el%C3%A9trico%22%20OR%20curtailment%20OR%20%22linhas%20de%20transmiss%C3%A3o%22%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — CCEE nos veículos dos relatórios (energia)', 'https://news.google.com/rss/search?q=%28site%3Acanalsolar.com.br%20OR%20site%3Aem.com.br%20OR%20site%3Aplurale.com.br%20OR%20site%3Arevistamundoeletrico.com.br%20OR%20site%3Aveja.abril.com.br%20OR%20site%3Abpmoney.com.br%29%20%28CCEE%20OR%20%22C%C3%A2mara%20de%20Comercializa%C3%A7%C3%A3o%22%20OR%20%22mercado%20livre%20de%20energia%22%20OR%20PLD%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — PRIO nos veículos dos relatórios (mercado)', 'https://news.google.com/rss/search?q=%28site%3Ainvestidor10.com.br%20OR%20site%3Amoneytimes.com.br%20OR%20site%3Aacionista.com.br%20OR%20site%3Abpmoney.com.br%20OR%20site%3Aveja.abril.com.br%20OR%20site%3Aneofeed.com.br%29%20%28PRIO%20OR%20%22Petro%20Rio%22%20OR%20%22PRIO%20S.A.%22%20OR%20PRIO3%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — SIMINERAL nos veículos dos relatórios (Pará)', 'https://news.google.com/rss/search?q=%28site%3Aoliberal.com%20OR%20site%3Abrasil61.com%20OR%20site%3Azedudu.com.br%20OR%20site%3Aaprovinciadopara.com.br%20OR%20site%3Ainvestidor10.com.br%20OR%20site%3Abrasil247.com%29%20%28Simineral%20OR%20%22minera%C3%A7%C3%A3o%20no%20Par%C3%A1%22%20OR%20Caraj%C3%A1s%20OR%20%22minera%C3%A7%C3%A3o%20paraense%22%20OR%20CFEM%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — SINDINFOR nos veículos dos relatórios (Minas e TI)', 'https://news.google.com/rss/search?q=%28site%3Acomputerworld.com.br%20OR%20site%3Aotempo.com.br%20OR%20site%3Aitatiaia.com.br%20OR%20site%3Aem.com.br%20OR%20site%3Astartups.com.br%20OR%20site%3Abaguete.com.br%29%20%28Sindinfor%20OR%20software%20OR%20%22empresas%20de%20tecnologia%22%20OR%20%22data%20center%22%20OR%20Assespro%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — DAQ nos veículos dos relatórios (Norte e logística)', 'https://news.google.com/rss/search?q=%28site%3Aacritica.com%20OR%20site%3Ad24am.com%20OR%20site%3Abncamazonas.com.br%20OR%20site%3Aoliberal.com%20OR%20site%3Aportalbenews.com.br%20OR%20site%3Aportogente.com.br%29%20%28DNIT%20OR%20dragagem%20OR%20hidrovia%20OR%20hidrovias%20OR%20%22transporte%20aquavi%C3%A1rio%22%20OR%20IP4%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Google News — ANTAQ nos veículos dos relatórios (logística)', 'https://news.google.com/rss/search?q=%28site%3Aportalbenews.com.br%20OR%20site%3Aportogente.com.br%20OR%20site%3Atecnologistica.com.br%20OR%20site%3Acampograndenews.com.br%20OR%20site%3Aahoradosul.com.br%20OR%20site%3Ajornalportuario.com.br%29%20%28ANTAQ%20OR%20%22setor%20portu%C3%A1rio%22%20OR%20cabotagem%20OR%20%22arrendamento%20portu%C3%A1rio%22%29%20when%3A30d&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true, false, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority;

-- Fonte do cliente: soma +1 como fonte temática quando uma regra dele casa.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 80, TRUE
FROM (VALUES
  ('ONS', 'Google News — ONS nos veículos dos relatórios (energia)'),
  ('CCEE', 'Google News — CCEE nos veículos dos relatórios (energia)'),
  ('PRIO', 'Google News — PRIO nos veículos dos relatórios (mercado)'),
  ('SIMINERAL', 'Google News — SIMINERAL nos veículos dos relatórios (Pará)'),
  ('SINDINFOR', 'Google News — SINDINFOR nos veículos dos relatórios (Minas e TI)'),
  ('DAQ', 'Google News — DAQ nos veículos dos relatórios (Norte e logística)'),
  ('ANTAQ', 'Google News — ANTAQ nos veículos dos relatórios (logística)')
) AS link(client_key, source_name)
JOIN clients client ON client.name = link.client_key OR client.name LIKE link.client_key || ' %'
JOIN sources source ON source.name = link.source_name
ON CONFLICT (client_id, source_id) DO UPDATE SET is_thematic = TRUE;

INSERT INTO client_relevance_rules (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT client.id, seed.label, seed.match_type, seed.groups::JSONB, seed.excluded, seed.weight, 1
FROM (VALUES
  ('ONS', 'dirigente: Valter Cardeal', 'direta', '[["Valter Cardeal"]]', '{}'::TEXT[], 8),
  ('ONS', 'dirigente: Sumara Ticom', 'direta', '[["Sumara Ticom"]]', '{}'::TEXT[], 8),
  ('ONS', 'iniciativa: Prêmio ONS de Qualidade na Operação', 'direta', '[["Prêmio ONS", "Prêmio de Qualidade na Operação"]]', '{}'::TEXT[], 8),
  ('ONS', 'iniciativa: Rede Potências', 'direta', '[["Rede Potências"]]', '{}'::TEXT[], 8),
  ('ONS', 'aprendido: COBRE (novo modelo de preços)', 'setorial', '[["COBRE"], ["Newave", "Decomp", "modelo computacional", "código aberto", "formação de preços"]]', '{}'::TEXT[], 4),
  ('ONS', 'aprendido: queda de torres e El Niño', 'setorial', '[["torres"], ["El Niño", "linhas de transmissão", "rede de transmissão", "tempestades"]]', '{}'::TEXT[], 3),
  ('ONS', 'aprendido: GO15', 'setorial', '[["GO15"]]', '{}'::TEXT[], 4),
  ('CCEE', 'porta-voz: Gerusa Côrtes', 'direta', '[["Gerusa Côrtes", "Gerusa Cortes"]]', '{}'::TEXT[], 8),
  ('CCEE', 'porta-voz: Ricardo Simabuku', 'direta', '[["Ricardo Simabuku", "Simabuku"]]', '{}'::TEXT[], 8),
  ('CCEE', 'aprendido: Leilão de Gás Natural da União', 'setorial', '[["leilão de gás", "Leilão de Gás Natural da União", "gás da União"], ["CCEE", "PPSA", "Pré-Sal Petróleo"]]', '{}'::TEXT[], 4),
  ('CCEE', 'aprendido: COBRE (novo modelo de preços)', 'setorial', '[["COBRE"], ["Newave", "Decomp", "modelo computacional", "código aberto", "PLD"]]', '{}'::TEXT[], 4),
  ('PRIO', 'aprendido: blocos Magnetita e Hematita', 'setorial', '[["Magnetita", "Hematita"], ["pré-sal", "partilha", "ANP", "Oferta Permanente", "Bacia de Campos"]]', ARRAY['PetroRecôncavo', 'RECV3', 'Brava Energia', 'BRAV3']::TEXT[], 5),
  ('PRIO', 'aprendido: Prio Forte', 'direta', '[["Prio Forte"]]', '{}'::TEXT[], 8),
  ('PRIO', 'aprendido: campo de Frade', 'setorial', '[["Frade"], ["campo", "Bacia de Campos", "petróleo", "Wahoo"]]', ARRAY['PetroRecôncavo', 'RECV3', 'Brava Energia', 'BRAV3']::TEXT[], 4),
  ('SIMINERAL', 'aprendido: Carta de Santarém', 'setorial', '[["Carta de Santarém", "Carta Santarém"]]', '{}'::TEXT[], 4),
  ('SIMINERAL', 'aprendido: Imposto Seletivo na mineração', 'setorial', '[["Imposto Seletivo"], ["mineração", "minério", "bens minerais", "mineradoras"]]', '{}'::TEXT[], 3),
  ('SIMINERAL', 'aprendido: CFEM no Pará', 'setorial', '[["CFEM", "Compensação Financeira pela Exploração"], ["Pará", "paraense", "Parauapebas", "Canaã dos Carajás", "Marabá"]]', '{}'::TEXT[], 4),
  ('SINDINFOR', 'aprendido: Assespro-MG e Fiemg Lab', 'setorial', '[["Assespro-MG", "Assespro Minas", "Fiemg Lab"]]', '{}'::TEXT[], 5),
  ('SINDINFOR', 'aprendido: split payment e o software', 'setorial', '[["split payment"], ["software", "ERP", "sistemas de gestão", "empresas de tecnologia", "setor de TI"]]', '{}'::TEXT[], 3),
  ('SINDINFOR', 'aprendido: reforma tributária e o software', 'setorial', '[["reforma tributária", "IBS", "CBS"], ["software", "empresas de TI", "setor de TI", "tecnologia da informação", "software houses"]]', '{}'::TEXT[], 3),
  ('DAQ', 'aprendido: IP4 (pequenas instalações portuárias)', 'setorial', '[["IP4", "Instalação Portuária de Pequeno Porte", "Instalações Portuárias de Pequeno Porte"]]', '{}'::TEXT[], 5),
  ('DAQ', 'aprendido: dragagem do Careiro', 'setorial', '[["Careiro"], ["dragagem", "travessia", "DNIT", "hidrovia"]]', '{}'::TEXT[], 4),
  ('DAQ', 'aprendido: Sul–Lagoa Mirim', 'setorial', '[["Lagoa Mirim", "Sul-Mirim"], ["hidrovia", "concessão", "aquaviário", "dragagem"]]', '{}'::TEXT[], 4),
  ('ANTAQ', 'diretor: Frederico Dias', 'direta', '[["Frederico Dias"]]', '{}'::TEXT[], 8),
  ('ANTAQ', 'aprendido: MUC04 em Fortaleza', 'setorial', '[["MUC04"]]', '{}'::TEXT[], 4),
  ('ANTAQ', 'aprendido: SSE no STF', 'setorial', '[["SSE"], ["porto", "portuário", "terminal", "STF", "contêiner"]]', '{}'::TEXT[], 3)
) AS seed(client_key, label, match_type, groups, excluded, weight)
JOIN clients client ON client.name = seed.client_key OR client.name LIKE seed.client_key || ' %'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight, active = TRUE, updated_at = NOW();

-- PetroRecôncavo e Brava fora das regras de setor da PRIO que já existiam.
UPDATE client_relevance_rules rule
SET excluded_terms = (SELECT ARRAY(SELECT DISTINCT unnest(rule.excluded_terms || ARRAY['PetroRecôncavo', 'RECV3', 'Brava Energia', 'BRAV3']))),
    updated_at = NOW()
FROM clients client
WHERE rule.client_id = client.id AND client.name = 'PRIO' AND rule.match_type <> 'direta'
  AND NOT (rule.excluded_terms @> ARRAY['PetroRecôncavo', 'RECV3', 'Brava Energia', 'BRAV3']);

INSERT INTO client_report_topic_templates (client_id, position, title, rationale, inclusion_terms, exclusion_terms, required)
SELECT client.id,
       COALESCE((SELECT MAX(t.position) FROM client_report_topic_templates t WHERE t.client_id = client.id), 0) + seed.ord,
       seed.title, 'Eixo dos destaques de outubro/2026 recebidos pelo cliente (docs/referencia-relatorios/2026-10-destaques).',
       seed.terms::JSONB, '[]'::JSONB, FALSE
FROM (VALUES
  ('ONS', 1, 'Operação especial no período eleitoral', '["operação especial", "segundo turno", "período eleitoral"]'),
  ('ONS', 2, 'Carga de energia e previsões do operador', '["carga de energia", "previsão de carga", "carga do SIN"]'),
  ('ONS', 3, 'Hidrologia, afluências e reservatórios', '["afluências", "reservatórios", "nível dos reservatórios"]'),
  ('ONS', 4, 'Prêmio ONS, GO15 e liderança', '["Prêmio ONS", "Qualidade na Operação", "GO15"]'),
  ('ONS', 5, 'COBRE, Newave e formação de preços', '["COBRE", "Newave", "Decomp"]'),
  ('ONS', 6, 'El Niño e queda de torres', '["El Niño", "queda de torres", "torres caíram"]'),
  ('ONS', 7, 'Rede Potências e diversidade no setor', '["Rede Potências", "diversidade étnico-racial"]'),
  ('CCEE', 8, '1º Leilão de Gás Natural da União', '["leilão de gás", "gás da União", "PPSA"]'),
  ('CCEE', 9, 'Liquidação financeira e encargos', '["liquidação financeira", "Mercado de Curto Prazo", "encargos de serviço do sistema", "ESS"]'),
  ('CCEE', 10, 'Geração distribuída e renováveis', '["geração distribuída", "micro e minigeração"]'),
  ('CCEE', 11, 'COBRE e o novo modelo de preços', '["COBRE", "Newave", "Decomp"]'),
  ('SINDINFOR', 12, 'Reforma tributária e o software', '["IBS", "CBS", "reforma tributária", "split payment"]'),
  ('SINDINFOR', 13, 'ERP e conformidade fiscal das PMEs', '["ERP", "sistemas de gestão", "nota fiscal"]'),
  ('SINDINFOR', 14, 'Pós-eleição e incentivos à inovação', '["FNDCT", "Lei do Bem", "Simples Nacional", "incentivos à inovação"]'),
  ('SINDINFOR', 15, 'Assespro-MG, Fiemg Lab e o ecossistema mineiro', '["Assespro-MG", "Fiemg Lab", "ecossistema de inovação"]'),
  ('SIMINERAL', 16, 'Carta de Santarém e ESG', '["Carta de Santarém", "Carta Santarém", "ESG"]'),
  ('SIMINERAL', 17, 'Imposto Seletivo e tributação mineral', '["Imposto Seletivo", "tributação da mineração", "bens minerais"]'),
  ('SIMINERAL', 18, 'CFEM e municípios mineradores', '["CFEM", "royalties da mineração", "municípios mineradores"]'),
  ('PRIO', 19, 'Pré-sal: blocos Magnetita e Hematita', '["Magnetita", "Hematita", "Oferta Permanente"]'),
  ('PRIO', 20, 'Recomendações de bancos e a ação PRIO3', '["preço-alvo", "recomendação de compra", "PRIO3"]'),
  ('PRIO', 21, 'Dividendos, recompra e alocação de capital', '["dividendos", "recompra de ações", "alocação de capital"]'),
  ('PRIO', 22, 'Câmbio e proteção cambial', '["dólar", "câmbio", "proteção cambial"]'),
  ('DAQ', 23, 'Seca na Amazônia e dragagens', '["seca", "estiagem", "dragagem"]'),
  ('DAQ', 24, 'IP4s: pequenas instalações portuárias', '["IP4", "Instalação Portuária de Pequeno Porte", "Instalações Portuárias de Pequeno Porte"]'),
  ('DAQ', 25, 'Sistema Sul–Lagoa Mirim', '["Lagoa Mirim", "Sul-Mirim"]'),
  ('DAQ', 26, 'Cabotagem e cargas feeder', '["cabotagem", "feeder"]'),
  ('DAQ', 27, 'Temporada de cruzeiros e terminais regionais', '["temporada de cruzeiros", "cruzeiros marítimos"]')
) AS seed(client_key, ord, title, terms)
JOIN clients client ON client.name = seed.client_key OR client.name LIKE seed.client_key || ' %'
ON CONFLICT (client_id, title) DO UPDATE SET inclusion_terms = EXCLUDED.inclusion_terms, active = TRUE, updated_at = NOW();

-- Conferência (cada linha deve trazer o número esperado):
-- SELECT count(*) FROM sources WHERE name LIKE 'Google News — % nos veículos dos relatórios (%';      -- 7
-- SELECT c.name, count(*) FROM client_relevance_rules r JOIN clients c ON c.id = r.client_id
--   WHERE r.label ~ '^(aprendido|porta-voz|dirigente|diretor|iniciativa):' GROUP BY 1 ORDER BY 1;     -- 27 (26 desta + Márcio Rea, da 040)
-- SELECT c.name, count(*) FROM client_report_topic_templates t JOIN clients c ON c.id = t.client_id
--   WHERE t.rationale LIKE 'Eixo dos destaques de outubro%' GROUP BY 1 ORDER BY 1;                  -- 27 temas no total

NOTIFY pgrst, 'reload schema';
