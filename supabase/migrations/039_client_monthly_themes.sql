-- 039: temas mensais por cliente, nas tres camadas que um tema precisa para
-- aparecer no Painel: fonte que traz a materia, regra que a marca para o
-- cliente e template que a agrupa.
--
-- Listas definidas pelo usuario em 31/10/2026 a partir do que a consultoria
-- montou a mao nos relatorios de setembro. A auditoria mostrou que a maioria
-- nao tinha regra nem consulta (Redata, Peregrino, Tecon 10, PNMCE, LRCAP).
--
-- required = FALSE: tema obrigatorio bloqueia o fechamento num mes magro
-- (uncoveredRequiredTopics). Promova depois de um ciclo real.
-- Termos sao frases longas: topicMatchesArticle casa por SUBSTRING. "armadores"
-- so aparece em contexto porque e homografo (ver 034). exclusion_terms vazios:
-- exclusao veta o documento inteiro.
-- Peso 3 = candidato (escala da 034): tema sozinho nao confirma materia sem
-- mencao ao cliente; continua sujeito a triagem.

CREATE TEMP TABLE IF NOT EXISTS seed_039 (
  client_key TEXT, ord INTEGER, title TEXT, terms TEXT
);
TRUNCATE seed_039;
INSERT INTO seed_039 VALUES
  ('CCEE', 1, 'Abertura do mercado livre e baixa tensão', '["abertura do mercado livre","mercado livre de energia","baixa tensão","Módulo 16"]'),
  ('CCEE', 2, 'Segurança de mercado, liquidez e comercializadoras', '["comercializadoras de energia","comercializadora de energia","fundo de liquidez","inadimplência no mercado de energia"]'),
  ('CCEE', 3, 'Gás natural, termelétricas e abertura do mercado de gás', '["mercado de gás","mercado livre de gás","termelétricas a gás","térmicas a gás","usinas termelétricas"]'),
  ('CCEE', 4, 'Regras de Comercialização 2027', '["Regras de Comercialização"]'),
  ('CCEE', 5, 'Formação de preços, PLD e transparência dos modelos', '["PLD","Preço de Liquidação das Diferenças","Newave","Dessem","formação de preços de energia"]'),
  ('CCEE', 6, 'Curtailment e segurança energética', '["curtailment","cortes de geração","segurança energética"]'),
  ('CCEE', 7, 'Reserva de capacidade e papel das térmicas', '["reserva de capacidade","LRCAP"]'),
  ('PRIO', 1, 'Imposto de exportação de 12% e segurança jurídica', '["imposto de exportação de petróleo","imposto sobre exportação de petróleo","imposto na exportação de petróleo","MP 1.340","MP 1340"]'),
  ('PRIO', 2, 'Brent elevado e captura de valor pelo produtor', '["petróleo Brent","barril de Brent","preço do Brent"]'),
  ('PRIO', 3, 'Produção da PRIO e trajetória para 200 mil bpd', '["produção da PRIO","200 mil barris","200 mil bpd"]'),
  ('PRIO', 4, 'Wahoo como vetor de crescimento', '["Wahoo"]'),
  ('PRIO', 5, 'Peregrino e desenvolvimento dos ativos', '["campo de Peregrino","campos de Peregrino","Pitangola"]'),
  ('PRIO', 6, 'Eficiência operacional, custos e campos maduros', '["campos maduros","campo maduro","lifting cost"]'),
  ('PRIO', 7, 'Reforma tributária e ambiente regulatório', '["reforma tributária no setor de óleo","reforma tributária pode aumentar carga do setor de óleo","tributação de óleo e gás"]'),
  ('PRIO', 8, 'Brasil exportador de petróleo e política industrial', '["exportador de petróleo","exportação de petróleo","política industrial do petróleo"]'),
  ('SINDINFOR', 1, 'Redata e regime especial para data centers', '["Redata","regime especial para data centers","regime especial de tributação para serviços de datacenter"]'),
  ('SINDINFOR', 2, 'Polêmica do gás natural no Redata', '["gás natural no Redata","gás no Redata","data centers a gás"]'),
  ('SINDINFOR', 3, 'Data center de grande escala em Paracatu', '["data center em Paracatu","data centers em Paracatu","Paracatu"]'),
  ('SINDINFOR', 4, 'Energia elétrica e expansão da IA', '["energia para data centers","consumo de energia de data centers","energia de data centers","data centers de IA"]'),
  ('SINDINFOR', 5, 'Licenciamento ambiental de data centers em Minas Gerais', '["licenciamento ambiental de data centers","data centers em Minas","data centers em MG"]'),
  ('SINDINFOR', 6, 'Regulamentação do Redata', '["decreto do Redata","regulamentação do Redata"]'),
  ('SINDINFOR', 7, 'ICMS e competitividade em data centers', '["ICMS para data centers","ICMS de data centers"]'),
  ('SINDINFOR', 8, 'Backbone, fibra óptica e conectividade', '["backbone","fibra óptica"]'),
  ('SINDINFOR', 9, 'Inteligência artificial e regulação de dados', '["regulação da inteligência artificial","marco legal da inteligência artificial","regulação de IA","proteção de dados"]'),
  ('SINDINFOR', 10, 'Nuvem brasileira e soberania digital', '["nuvem soberana","nuvem brasileira","soberania digital"]'),
  ('SINDINFOR', 11, 'Cibersegurança e infraestrutura digital crítica', '["cibersegurança","segurança cibernética","ataque cibernético","infraestrutura digital crítica"]'),
  ('SIMINERAL', 1, 'Política Nacional de Minerais Críticos e Estratégicos', '["PNMCE","Política Nacional de Minerais Críticos","marco legal dos minerais críticos","Lei dos Minerais Críticos"]'),
  ('SIMINERAL', 2, 'Conselho Nacional de Minerais Críticos (CIMCE)', '["CIMCE","Conselho de Minerais Críticos","Conselho Nacional para Industrialização de Minerais"]'),
  ('SIMINERAL', 3, 'Regulamentação da nova política mineral', '["regulamentação da política de minerais","regulamentação dos minerais críticos"]'),
  ('SIMINERAL', 4, 'Agregação de valor e beneficiamento mineral', '["agregação de valor mineral","beneficiamento de minerais","agregação de valor aos minerais","agregação de valor na mineração"]'),
  ('SIMINERAL', 5, 'Simplificação da pesquisa mineral', '["pesquisa mineral"]'),
  ('SIMINERAL', 6, 'Mineração, comunidades tradicionais e segurança jurídica', '["mineração em terras indígenas","comunidades tradicionais e mineração","mineração e comunidades tradicionais"]'),
  ('SIMINERAL', 7, 'Fortalecimento da ANM', '["fortalecimento da ANM","fortalecer a ANM","Agência Nacional de Mineração"]'),
  ('SIMINERAL', 8, 'Rastreabilidade dos minerais críticos', '["rastreabilidade dos minerais","rastreabilidade mineral"]'),
  ('SIMINERAL', 9, 'Fundo Garantidor da Atividade Mineral (FGAM)', '["FGAM","Fundo Garantidor da Atividade Mineral"]'),
  ('SIMINERAL', 10, 'PD&I na mineração', '["inovação na mineração","pesquisa e desenvolvimento na mineração","PD&I na mineração"]'),
  ('SIMINERAL', 11, 'Terras raras e minerais estratégicos', '["terras raras","minerais estratégicos"]'),
  ('SIMINERAL', 12, 'Competitividade na corrida global por minerais críticos', '["corrida global por minerais","minerais críticos"]'),
  ('DAQ', 1, 'Concessão do canal de acesso ao Porto de Santos', '["canal de acesso ao Porto de Santos","canal de Santos","canal de acesso de Santos"]'),
  ('DAQ', 2, 'Tecon Santos 10 e capacidade de contêineres', '["Tecon Santos 10","Tecon 10","STS10"]'),
  ('DAQ', 3, 'Disputa concorrencial de armadores no Tecon 10', '["armadores no Tecon","cláusula de armadores","armadores do Tecon"]'),
  ('DAQ', 4, 'Concessões de hidrovias', '["concessão de hidrovia","concessões de hidrovias","concessão da hidrovia","concessão hidroviária"]'),
  ('DAQ', 5, 'Hidrovia do Tocantins', '["Hidrovia do Tocantins","Hidrovia Araguaia-Tocantins","Pedral do Lourenço"]'),
  ('DAQ', 6, 'Hidrovia do Paraguai', '["Hidrovia do Paraguai","Hidrovia Paraguai-Paraná"]'),
  ('DAQ', 7, 'Hidrovia do Madeira', '["Hidrovia do Madeira","Rio Madeira"]'),
  ('DAQ', 8, 'Hidrovia do Tapajós e Arco Norte', '["Hidrovia do Tapajós","Arco Norte"]'),
  ('DAQ', 9, 'PNL 2050 e infraestrutura aquaviária', '["PNL 2050","Plano Nacional de Logística"]'),
  ('DAQ', 10, 'Integração entre hidrovias, portos, ferrovias e rodovias', '["intermodalidade","multimodal","integração hidroviária"]'),
  ('DAQ', 11, 'Gargalos e saturação dos portos', '["saturação dos portos","gargalos portuários","gargalo portuário","capacidade portuária"]'),
  ('DAQ', 12, 'Regulação dos Terminais de Uso Privado', '["Terminais de Uso Privado","Terminal de Uso Privado"]'),
  ('DAQ', 13, 'Licenciamento ambiental, dragagem e segurança jurídica', '["licenciamento da dragagem","dragagem","licenciamento do canal"]'),
  ('DAQ', 14, 'Seguros e alocação de riscos em concessões', '["GT Seguros","seguros em concessões","seguros aquaviários","alocação de riscos"]'),
  ('ONS', 1, 'Reserva de capacidade e necessidade de potência', '["reserva de capacidade","necessidade de potência"]'),
  ('ONS', 2, 'LRCAP e leilões de potência', '["LRCAP","leilão de potência","leilões de potência","leilão de capacidade"]'),
  ('ONS', 3, 'Baterias e armazenamento de energia', '["armazenamento de energia","baterias no sistema elétrico","leilão de baterias"]'),
  ('ONS', 4, 'Baterias para reduzir curtailment', '["baterias podem reduzir cortes","baterias e curtailment","baterias para reduzir"]'),
  ('ONS', 5, 'Geração distribuída e regulação', '["geração distribuída"]'),
  ('ONS', 6, 'Excesso de geração renovável e curtailment', '["curtailment","cortes de geração"]'),
  ('ONS', 7, 'Perfil operacional do SIN e flexibilidade', '["flexibilidade do sistema elétrico","flexibilidade operativa","Sistema Interligado Nacional"]'),
  ('ONS', 8, 'Grandes cargas e data centers', '["grandes cargas","data centers ao sistema elétrico","conexão de data centers","conexões de data centers"]'),
  ('ONS', 9, 'Despacho térmico, hidrologia e El Niño', '["despacho térmico","El Niño","risco hidrológico"]'),
  ('ONS', 10, 'Segurança e confiabilidade da operação do SIN', '["confiabilidade do sistema elétrico","segurança do sistema elétrico","apagão","blecaute"]');

-- MAX(position) + ord: a UNIQUE(client_id, position) descartaria linha em
-- silencio se o numero colidisse com template existente (ver 038).
INSERT INTO client_report_topic_templates
  (client_id, position, title, rationale, inclusion_terms, exclusion_terms, required)
SELECT client.id,
       COALESCE((SELECT MAX(t.position) FROM client_report_topic_templates t WHERE t.client_id = client.id), 0) + seed.ord,
       seed.title, 'Tema mensal definido pela curadoria (setembro/2026).',
       seed.terms::JSONB, '[]'::JSONB, FALSE
FROM seed_039 seed
JOIN clients client ON client.name = seed.client_key OR client.name LIKE seed.client_key || ' %'
ON CONFLICT (client_id, title) DO UPDATE SET
  inclusion_terms = EXCLUDED.inclusion_terms, active = TRUE, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT client.id, 'tema: ' || seed.title, 'setorial',
       jsonb_build_array(seed.terms::JSONB), '{}'::TEXT[], 3, 1
FROM seed_039 seed
JOIN clients client ON client.name = seed.client_key OR client.name LIKE seed.client_key || ' %'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, active = TRUE, updated_at = NOW();

-- 'referencia': vem de Google News/veiculos de terceiros; nao autoriza integra.
INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Google News — Energia — temas de operação e mercado', 'https://news.google.com/rss/search?q=%22reserva%20de%20capacidade%22%20OR%20LRCAP%20OR%20curtailment%20OR%20%22gera%C3%A7%C3%A3o%20distribu%C3%ADda%22%20OR%20%22armazenamento%20de%20energia%22%20OR%20%22despacho%20t%C3%A9rmico%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Energia — comercialização e preços', 'https://news.google.com/rss/search?q=%22Regras%20de%20Comercializa%C3%A7%C3%A3o%22%20OR%20comercializadoras%20OR%20PLD%20OR%20%22abertura%20do%20mercado%20livre%22%20OR%20%22baixa%20tens%C3%A3o%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Petróleo — PRIO e tributação', 'https://news.google.com/rss/search?q=Wahoo%20OR%20Peregrino%20OR%20%22imposto%20de%20exporta%C3%A7%C3%A3o%22%20petr%C3%B3leo%20OR%20%22PRIO%22%20petr%C3%B3leo%20OR%20Brent&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Data centers — Redata e infraestrutura', 'https://news.google.com/rss/search?q=Redata%20OR%20%22data%20center%22%20OR%20%22data%20centers%22%20OR%20%22nuvem%20soberana%22%20OR%20backbone&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — TI — cibersegurança e regulação de IA', 'https://news.google.com/rss/search?q=ciberseguran%C3%A7a%20OR%20%22seguran%C3%A7a%20cibern%C3%A9tica%22%20OR%20%22regula%C3%A7%C3%A3o%20da%20intelig%C3%AAncia%20artificial%22%20OR%20%22soberania%20digital%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Mineração — minerais críticos', 'https://news.google.com/rss/search?q=%22minerais%20cr%C3%ADticos%22%20OR%20PNMCE%20OR%20CIMCE%20OR%20FGAM%20OR%20%22pesquisa%20mineral%22%20OR%20%22Ag%C3%AAncia%20Nacional%20de%20Minera%C3%A7%C3%A3o%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Portos — Santos e Tecon 10', 'https://news.google.com/rss/search?q=%22Tecon%2010%22%20OR%20%22Tecon%20Santos%2010%22%20OR%20%22canal%20de%20Santos%22%20OR%20%22Terminais%20de%20Uso%20Privado%22%20OR%20%22PNL%202050%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Hidrovias — concessões e Arco Norte', 'https://news.google.com/rss/search?q=%22Hidrovia%20do%20Tocantins%22%20OR%20%22Hidrovia%20do%20Paraguai%22%20OR%20%22Hidrovia%20do%20Madeira%22%20OR%20%22Hidrovia%20do%20Tapaj%C3%B3s%22%20OR%20%22Arco%20Norte%22%20OR%20%22concess%C3%A3o%20de%20hidrovia%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Data Center Dynamics Brasil', 'https://news.google.com/rss/search?q=site%3Adatacenterdynamics.com%2Fbr&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Teletime', 'https://news.google.com/rss/search?q=site%3Ateletime.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Radar Mineração', 'https://news.google.com/rss/search?q=site%3Aradarmineracao.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Portal Marítimo', 'https://news.google.com/rss/search?q=site%3Aportalmaritimo.com&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Google News — Logweb', 'https://news.google.com/rss/search?q=site%3Alogweb.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 90, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name, active = TRUE, access_mode = EXCLUDED.access_mode;

-- Pos-condicao: cliente sem nenhum tema significa nome divergente; falha alto.
DO $$
DECLARE missing TEXT;
BEGIN
  SELECT string_agg(DISTINCT seed.client_key, ', ') INTO missing
  FROM seed_039 seed
  WHERE NOT EXISTS (
    SELECT 1 FROM client_report_topic_templates t JOIN clients c ON c.id = t.client_id
    WHERE t.title = seed.title AND (c.name = seed.client_key OR c.name LIKE seed.client_key || ' %')
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION '039: temas nao aplicados para %', missing;
  END IF;
END $$;

DROP TABLE seed_039;
