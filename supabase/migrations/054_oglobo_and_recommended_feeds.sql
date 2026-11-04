-- 054: O Globo pelo feed geral oficial (o RSS por editoria dá 400; /rss/oglobo
-- responde 200 com 100 itens) e as fontes que a conferência de outubro apontou
-- (docs/relatorios-refeitos/2026-10/RESUMO.md). Testados em 04/11/2026.
-- Eixos e MegaWhat já existiam: aqui só garantimos que estão ativos.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('O Globo — feed oficial', 'https://oglobo.globo.com/rss/oglobo', 'rss', true, true, 90, 'imprensa', 'referencia'),
  ('Brasil Mineral', 'https://www.brasilmineral.com.br/feed', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('TI Inside — feed oficial', 'https://tiinside.com.br/feed/', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Teletime — feed oficial', 'https://teletime.com.br/feed/', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('Convergência Digital — feed oficial', 'https://convergenciadigital.com.br/feed/', 'rss', true, false, 85, 'imprensa', 'referencia'),
  ('SindInfor-MG — notícias', 'https://sindinfor.org.br/feed/', 'rss', true, false, 90, 'institucional', 'referencia'),
  -- Melhor fonte mineira de TI com data na conferência de outubro.
  ('Diário do Comércio (MG) — feed oficial', 'https://diariodocomercio.com.br/feed/', 'rss', true, true, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority;

UPDATE sources SET active = TRUE
WHERE url IN ('https://eixos.com.br/feed', 'https://eixos.com.br/feed/', 'https://megawhat.energy/feed/', 'https://megawhat.uol.com.br/feed')
  AND active IS DISTINCT FROM TRUE;

-- Fontes setoriais do cliente somam +1 quando alguma regra dele já casou.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 85, TRUE
FROM (VALUES
  ('SIMINERAL', 'Brasil Mineral'),
  ('SINDINFOR', 'TI Inside — feed oficial'),
  ('SINDINFOR', 'Teletime — feed oficial'),
  ('SINDINFOR', 'Convergência Digital — feed oficial'),
  ('SINDINFOR', 'SindInfor-MG — notícias')
) AS link(client_name, source_name)
JOIN clients client ON client.name = link.client_name
JOIN sources source ON source.name = link.source_name
ON CONFLICT (client_id, source_id) DO UPDATE SET is_thematic = TRUE, priority = EXCLUDED.priority;

-- SindInfor é o sindicato de Minas Gerais (confirmado pelo dono em 04/11/2026);
-- a 051 tinha copiado "Brasília/DF" do README do zip.
UPDATE client_report_profiles profile
SET location = 'Belo Horizonte/MG', display_name = 'SindInfor-MG', updated_at = NOW()
FROM clients client
WHERE client.id = profile.client_id AND client.name = 'SINDINFOR';
