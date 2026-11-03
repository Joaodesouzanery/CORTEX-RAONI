-- 048: marca do entregavel por cliente e temas pedidos pelo usuario em 03/11/2026.
-- Marcas confirmadas: PRIO = Vortex, ONS = CRT. Demais clientes seguem como estao.
UPDATE clients SET contratante = 'Vortex' WHERE name = 'PRIO' AND contratante IS DISTINCT FROM 'Vortex';
UPDATE clients SET contratante = 'CRT' WHERE name = 'ONS' AND contratante IS DISTINCT FROM 'CRT';

CREATE TEMP TABLE IF NOT EXISTS seed_048 (client_key TEXT, title TEXT, terms TEXT);
TRUNCATE seed_048;
INSERT INTO seed_048 VALUES
  ('ONS', 'Perspectivas do novo governo para o setor elétrico', '["novo governo","próximo governo","transição de governo","Ministério de Minas e Energia","ministro de Minas e Energia"]'),
  ('CCEE', 'Perspectivas do novo governo para o setor elétrico', '["novo governo","próximo governo","transição de governo","Ministério de Minas e Energia","ministro de Minas e Energia"]'),
  ('SINDINFOR', 'Governo de Minas e a indústria de software', '["governo de Minas","Governo de Minas Gerais","governador de Minas","Cleitinho"]'),
  ('SIMINERAL', 'Novos marcos legais e regulatórios da mineração', '["marco legal da mineração","Código de Mineração","marco regulatório da mineração","regulamentação da mineração","Lei dos Minerais Críticos"]');

INSERT INTO client_report_topic_templates
  (client_id, position, title, rationale, inclusion_terms, exclusion_terms, required)
SELECT client.id,
       COALESCE((SELECT MAX(t.position) FROM client_report_topic_templates t WHERE t.client_id = client.id), 0) + 1,
       seed.title, 'Tema pedido pelo usuário em 03/11/2026.', seed.terms::JSONB, '[]'::JSONB, FALSE
FROM seed_048 seed JOIN clients client ON client.name = seed.client_key
ON CONFLICT (client_id, title) DO UPDATE SET inclusion_terms = EXCLUDED.inclusion_terms, active = TRUE, updated_at = NOW();

-- Sem regra, o tema agruparia so materias ja marcadas por outro motivo.
-- SINDINFOR exige contexto de tecnologia: "governo de Minas" sozinho e amplo demais.
INSERT INTO client_relevance_rules (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT client.id, 'tema: ' || seed.title, 'setorial',
       CASE WHEN seed.client_key = 'SINDINFOR'
            THEN jsonb_build_array(seed.terms::JSONB, '["software","tecnologia da informação","data center","economia digital","inovação"]'::JSONB)
            WHEN seed.client_key IN ('ONS', 'CCEE')
            THEN jsonb_build_array(seed.terms::JSONB, '["setor elétrico","energia elétrica","conta de luz","Aneel"]'::JSONB)
            ELSE jsonb_build_array(seed.terms::JSONB) END,
       '{}'::TEXT[], 3, 1
FROM seed_048 seed JOIN clients client ON client.name = seed.client_key
ON CONFLICT (client_id, label) DO UPDATE SET required_groups = EXCLUDED.required_groups, active = TRUE, updated_at = NOW();

-- Click Petroleo e Gas aparece nos clippings e tem itens no Google News.
INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Click Petróleo e Gás — via Google News', 'https://news.google.com/rss/search?q=site%3Aclickpetroleoegas.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET active = TRUE;

DROP TABLE seed_048;
