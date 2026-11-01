-- 042: consolida fontes duplicadas do mesmo veiculo, achadas na lista de fontes
-- em 01/11/2026. Nada e apagado: a antiga so fica inativa e mantem o historico.
-- Vinculos e feed_names migram antes, porque feed_names da o +1 tematico por
-- NOME e desativar sem migrar tiraria pontuacao em silencio.

CREATE TEMP TABLE IF NOT EXISTS merge_042 (old_url TEXT, keep_url TEXT);
TRUNCATE merge_042;
INSERT INTO merge_042 VALUES
  ('https://eixos.com.br/feed/', 'https://eixos.com.br/feed'),
  ('https://www.infomoney.com.br/feed/', 'https://www.infomoney.com.br/feed'),
  ('https://exame.com/feed/', 'https://exame.com/feed'),
  ('https://braziljournal.com/feed/', 'https://braziljournal.com/feed'),
  ('https://www.agenciainfra.com/blog/feed/', 'https://agenciainfra.com/blog/feed'),
  ('https://megawhat.energy/feed/', 'https://megawhat.uol.com.br/feed'),
  ('https://news.google.com/rss/search?q=site%3Ateletime.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'https://teletime.com.br/feed'),
  ('https://news.google.com/rss/search?q=site%3Alogweb.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'https://www.logweb.com.br/feed'),
  ('https://news.google.com/rss/search?q=site%3Aradarmineracao.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'https://radarmineracao.com.br/feed'),
  ('https://news.google.com/rss/search?q=site%3Adatacenterdynamics.com%2Fbr&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'https://www.datacenterdynamics.com/br/rss/'),
  ('https://news.google.com/rss/search?q=site%3Aportalmaritimo.com&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'https://portalmaritimo.com/feed');

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT link.client_id, keep.id, link.priority, link.is_thematic
FROM merge_042 m
JOIN sources old ON old.url = m.old_url
JOIN sources keep ON keep.url = m.keep_url
JOIN client_sources link ON link.source_id = old.id
ON CONFLICT (client_id, source_id) DO UPDATE SET
  is_thematic = client_sources.is_thematic OR EXCLUDED.is_thematic;

UPDATE clients client
SET feed_names = array_replace(client.feed_names, old.name, keep.name)
FROM merge_042 m
JOIN sources old ON old.url = m.old_url
JOIN sources keep ON keep.url = m.keep_url
WHERE old.name <> keep.name AND old.name = ANY(client.feed_names);

-- So desativa se a fonte mantida existe: sem ela, o veiculo sumiria.
UPDATE sources old SET active = FALSE
FROM merge_042 m
JOIN sources keep ON keep.url = m.keep_url
WHERE old.url = m.old_url;

-- Consulta datada: a vacatio dos decretos ja passou e a fonte vem vazia.
UPDATE sources SET active = FALSE
WHERE name = 'Google News — SINDINFOR/Vacatio dos Decretos 12.975 e 12.976';

DROP TABLE merge_042;
