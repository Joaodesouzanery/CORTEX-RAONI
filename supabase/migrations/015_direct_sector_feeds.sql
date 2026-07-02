-- 015: adiciona feeds RSS diretos por setor (validados no QA: HTTP 200, itens
-- recentes, com texto completo e imagem). Reduz a dependência do Google News —
-- que chega só com título — e melhora o corpo das matérias no dossiê.
-- Idempotente (ON CONFLICT pela url UNIQUE). Depende do schema de sources.

INSERT INTO sources (name, url, type, active) VALUES
  ('Diário do Transporte',  'https://diariodotransporte.com.br/feed/',        'rss', true),
  ('Mineração Brasil',      'https://mineracaobrasil.com/feed/',              'rss', true),
  ('TI Inside',             'https://tiinside.com.br/feed/',                  'rss', true),
  ('Startups',              'https://startups.com.br/feed/',                  'rss', true),
  ('Convergência Digital',  'https://www.convergenciadigital.com.br/feed/',   'rss', true)
ON CONFLICT (url) DO UPDATE SET
  name   = EXCLUDED.name,
  type   = EXCLUDED.type,
  active = true;

-- "Mineração Brasil" é um feed setorial puro (tudo é on-topic), então entra no
-- feed_names do cliente Mineração — dando a ele um feed DIRETO (texto + imagem)
-- além do temático do Google News. Os demais feeds diretos (transporte, TI) são
-- nacionais/amplos e contribuem via keywords/synonyms (migration 014).
UPDATE clients
  SET feed_names = ARRAY['Google News — Mineração', 'Mineração Brasil']
  WHERE name = 'Mineração';
