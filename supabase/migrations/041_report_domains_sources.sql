-- 041: cobre os veiculos que aparecem nos relatorios de setembro/2026 e ainda
-- nao estavam no catalogo. Testado em 31/10/2026: feeds diretos com HTTP 200 e
-- XML. Os demais bloquearam ou nao expoem feed: entram por Google News, sem
-- contornar bloqueio. As regras por cliente seguem filtrando feeds amplos.
-- Depois de 2 ciclos, conferir em fetch_run_sources as que vierem vazias.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('MegaWhat (domínio atual)', 'https://megawhat.uol.com.br/feed', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Movimento Econômico', 'https://movimentoeconomico.com.br/feed', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Canal Rural', 'https://www.canalrural.com.br/feed', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Câmara dos Deputados — Notícias', 'https://www.camara.leg.br/noticias/rss/ultimas-noticias', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Senado — Notícias', 'https://www12.senado.leg.br/noticias/feed/todasnoticias/RSS', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Baguete', 'https://www.baguete.com.br/rss', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Brasil de Fato', 'https://www.brasildefato.com.br/feed', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Correio Braziliense — via Google News', 'https://news.google.com/rss/search?q=site%3Acorreiobraziliense.com.br%20(energia%20OR%20minera%C3%A7%C3%A3o%20OR%20petr%C3%B3leo%20OR%20portos%20OR%20hidrovia%20OR%20%22data%20center%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Época Negócios — via Google News', 'https://news.google.com/rss/search?q=site%3Aepocanegocios.globo.com%20(energia%20OR%20minera%C3%A7%C3%A3o%20OR%20petr%C3%B3leo%20OR%20portos%20OR%20hidrovia%20OR%20%22data%20center%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Jornal do Comércio — via Google News', 'https://news.google.com/rss/search?q=site%3Ajornaldocomercio.com%20(energia%20OR%20minera%C3%A7%C3%A3o%20OR%20petr%C3%B3leo%20OR%20portos%20OR%20hidrovia%20OR%20%22data%20center%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Energia Hoje — via Google News', 'https://news.google.com/rss/search?q=site%3Aenergiahoje.info&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Portal Solar — via Google News', 'https://news.google.com/rss/search?q=site%3Aportalsolar.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Gerawatts — via Google News', 'https://news.google.com/rss/search?q=site%3Agerawatts.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('NTC&Logística — via Google News', 'https://news.google.com/rss/search?q=site%3Antcelogistica.org.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Revista Portuária — via Google News', 'https://news.google.com/rss/search?q=site%3Arevistaporturia.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('FIEMG tecnologia — via Google News', 'https://news.google.com/rss/search?q=site%3Afiemg.com.br%20(tecnologia%20OR%20inova%C3%A7%C3%A3o%20OR%20software)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Agência Gov — via Google News', 'https://news.google.com/rss/search?q=site%3Aagenciagov.ebc.com.br%20(energia%20OR%20minera%C3%A7%C3%A3o%20OR%20petr%C3%B3leo%20OR%20portos%20OR%20hidrovia%20OR%20%22data%20center%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Escritórios — setores regulados — via Google News', 'https://news.google.com/rss/search?q=(site%3Amattosfilho.com.br%20OR%20site%3Ademarest.com.br)%20(minera%C3%A7%C3%A3o%20OR%20energia%20OR%20petr%C3%B3leo%20OR%20portos%20OR%20%22data%20center%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia'),
  ('Portal da Regulação e agências — via Google News', 'https://news.google.com/rss/search?q=(ANEEL%20OR%20ANTAQ%20OR%20ANP%20OR%20ANM%20OR%20ANATEL)%20(%22consulta%20p%C3%BAblica%22%20OR%20%22audi%C3%AAncia%20p%C3%BAblica%22%20OR%20%22agenda%20regulat%C3%B3ria%22)&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 80, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE;

-- Vinculos tematicos da PRIO agora em migration: antes existiam so pela UI.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 70, FALSE
FROM clients client
JOIN sources source ON source.name IN ('InfoMoney', 'Eixos', 'Agência Brasil — Economia', 'Brazil Journal')
WHERE client.name = 'PRIO'
ON CONFLICT (client_id, source_id) DO NOTHING;
