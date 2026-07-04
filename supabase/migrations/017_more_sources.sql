-- 017: amplia a cobertura de fontes para aproximar o CORTEX do volume/variedade
-- do relatório-ouro (imprensa especializada de energia + institucionais/reguladores).
-- Fontes validadas por curl (HTTP 200, itens recentes). Idempotente (ON CONFLICT url).
-- Depende do schema de sources e das migrations 005/013/015/016.

-- (1) Imprensa especializada / negócios (feed direto; várias com assinatura dc:creator)
INSERT INTO sources (name, url, type, active) VALUES
  ('Cenário Energia', 'https://cenarioenergia.com.br/feed/', 'rss', true),
  ('InfoMoney',       'https://www.infomoney.com.br/feed/',  'rss', true),
  ('NeoFeed',         'https://neofeed.com.br/feed/',        'rss', true)
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, active = true;

-- Reativa a MegaWhat com o feed DIRETO (a 016 a havia desativado; o direto funciona
-- e traz assinatura). Atualiza a linha existente por nome, e garante via url.
UPDATE sources SET url = 'https://megawhat.energy/feed/', active = true WHERE name = 'MegaWhat';
INSERT INTO sources (name, url, type, active) VALUES
  ('MegaWhat', 'https://megawhat.energy/feed/', 'rss', true)
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = true;

-- (2) Institucionais / reguladores (via Google News; ~100 itens cada)
INSERT INTO sources (name, url, type, active) VALUES
  ('Institucional — MME',   'https://news.google.com/rss/search?q=site:gov.br/mme&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — ANEEL', 'https://news.google.com/rss/search?q=ANEEL%20setor%20el%C3%A9trico&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — EPE',   'https://news.google.com/rss/search?q=site:epe.gov.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — ONS',   'https://news.google.com/rss/search?q=site:ons.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — CCEE',  'https://news.google.com/rss/search?q=site:ccee.org.br&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — ANM',   'https://news.google.com/rss/search?q=%22Ag%C3%AAncia%20Nacional%20de%20Minera%C3%A7%C3%A3o%22&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true),
  ('Institucional — Antaq', 'https://news.google.com/rss/search?q=Antaq%20hidrovia%20OR%20porto&hl=pt-BR&gl=BR&ceid=BR:pt-419', 'rss', true)
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, active = true;

-- (3) Mapear nos feed_names APENAS os institucionais setor-específicos (todo o
-- conteúdo é on-topic). Os amplos (MME/ANEEL/EPE/InfoMoney/NeoFeed) entram por
-- keyword/synonym (refinadas na 016), preservando a precisão.
UPDATE clients SET feed_names = ARRAY['Google News — ONS/Setor Elétrico', 'Institucional — ONS'] WHERE name = 'ONS';
UPDATE clients SET feed_names = ARRAY['Google News — CCEE/Mercado de Energia', 'Institucional — CCEE'] WHERE name = 'CCEE';
UPDATE clients SET feed_names = ARRAY['Google News — Mineração', 'Mineração Brasil', 'Institucional — ANM'] WHERE name = 'Mineração';
UPDATE clients SET feed_names = ARRAY['Google News — Aquaviário/Hidrovias', 'Institucional — Antaq'] WHERE name = 'DNIT Aquaviária';
