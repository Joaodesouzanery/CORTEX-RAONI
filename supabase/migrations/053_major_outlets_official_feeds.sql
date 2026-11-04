-- 053: feeds RSS oficiais e públicos dos grandes veículos. Testados em
-- 04/11/2026 (HTTP 200, itens no XML). Entregam título, resumo e link — o que o
-- veículo publica no próprio feed; nada atrás de paywall. Valor e Estadão
-- devolvem 100 itens; com a coleta 3x/dia e a busca por cliente da 051 a
-- matéria do cliente não se perde entre as centenas do dia.
-- is_general = TRUE: sem vínculo com cliente (não soma como fonte temática);
-- só entra para um cliente quando as regras dele casam no título/resumo.
-- Brasil Energia (feed 403) e O Globo (RSS 400) seguem fora; ver docs/fontes-bloqueadas.md.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Valor Econômico — feed oficial', 'https://valor.globo.com/rss/valor', 'rss', true, true, 90, 'imprensa', 'referencia'),
  ('Estadão — feed oficial', 'https://www.estadao.com.br/arc/outboundfeeds/rss/?outputType=xml', 'rss', true, true, 90, 'imprensa', 'referencia'),
  ('CNN Brasil — feed oficial', 'https://www.cnnbrasil.com.br/feed/', 'rss', true, true, 90, 'imprensa', 'referencia'),
  ('Folha — Mercado (feed oficial)', 'https://feeds.folha.uol.com.br/mercado/rss091.xml', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('Folha — Poder (feed oficial)', 'https://feeds.folha.uol.com.br/poder/rss091.xml', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('G1 — Economia (feed oficial)', 'https://g1.globo.com/rss/g1/economia/', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('G1 — Tecnologia (feed oficial)', 'https://g1.globo.com/rss/g1/tecnologia/', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('Poder360 — feed oficial', 'https://www.poder360.com.br/feed/', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('InfoMoney — feed oficial', 'https://www.infomoney.com.br/feed/', 'rss', true, true, 85, 'imprensa', 'referencia'),
  ('Metrópoles — feed oficial', 'https://www.metropoles.com/feed', 'rss', true, true, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority;
