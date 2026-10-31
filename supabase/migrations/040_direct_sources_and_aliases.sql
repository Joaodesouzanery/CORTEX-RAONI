-- 040: reduz a dependencia do Google News e corrige lacunas achadas contra os
-- relatorios de setembro e os 9 destaques indicados pelo usuario (31/10/2026).
--
-- Feeds diretos testados em 31/10/2026 (HTTP 200 com XML de feed). LawInfra, R7
-- e UOL nao expuseram feed nas URLs testadas: entram por consulta Google News.
-- 'referencia': o feed nao autoriza republicar a integra.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Times Brasil', 'https://timesbrasil.com.br/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Brazil Journal', 'https://braziljournal.com/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Teletime', 'https://teletime.com.br/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Radar Mineração', 'https://radarmineracao.com.br/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Portal Marítimo', 'https://portalmaritimo.com/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Logweb', 'https://www.logweb.com.br/feed', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Data Center Dynamics Brasil', 'https://www.datacenterdynamics.com/br/rss/', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Agência Brasil — Economia', 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Agência iNFRA', 'https://agenciainfra.com/blog/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Eixos', 'https://eixos.com.br/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('Exame', 'https://exame.com/feed', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('InfoMoney', 'https://www.infomoney.com.br/feed', 'rss', true, false, 90, 'imprensa', 'referencia'),
  ('LawInfra — via Google News', 'https://news.google.com/rss/search?q=site%3Alawinfra.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('R7 — setores monitorados via Google News', 'https://news.google.com/rss/search?q=site%3Anoticias.r7.com%20(ONS%20OR%20CCEE%20OR%20Redata%20OR%20Sindinfor%20OR%20Sindifor%20OR%20mineração%20OR%20hidrovia)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('UOL Economia — setores monitorados via Google News', 'https://news.google.com/rss/search?q=site%3Aeconomia.uol.com.br%20(ONS%20OR%20CCEE%20OR%20%22setor%20elétrico%22%20OR%20mineração%20OR%20petróleo%20OR%20portos)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE;

-- O destaque do R7 grafa "Sindifor", sem o "n": a regra direta nao o marcava.
-- Marcio Rea e o Diretor-Geral do ONS e aparece sem o nome do orgao em chamadas.
INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT client.id, seed.label, 'direta', seed.terms::JSONB, '{}'::TEXT[], 8, 1
FROM (VALUES
  ('SINDINFOR', 'grafia alternativa Sindifor', '[["Sindifor"]]'),
  ('ONS', 'dirigente: Márcio Rea', '[["Márcio Rea"]]')
) AS seed(client_name, label, terms)
JOIN clients client ON client.name = seed.client_name
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, active = TRUE, updated_at = NOW();
