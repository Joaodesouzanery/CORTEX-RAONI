-- 010: refine noisy Google News queries (precision) + reinforce energy sources.
-- Queries validated by fetching the refined feeds. Idempotent.

-- Software/TI was noisy (universities/courts via the generic "tecnologia da
-- informação"). Tighten to the software INDUSTRY (validated: startups, InfoMoney,
-- FecomercioSP, Sindinfor — on-topic).
UPDATE sources SET url =
  'https://news.google.com/rss/search?q=%22ind%C3%BAstria%20de%20software%22%20OR%20%22setor%20de%20software%22%20OR%20%22mercado%20de%20software%22%20OR%20%22empresas%20de%20software%22%20OR%20Sindinfor&hl=pt-BR&gl=BR&ceid=BR:pt-419'
WHERE name = 'Google News — Software/TI';

-- Rodovias: focus on road infrastructure (DNIT, OAEs, concessões) instead of
-- generic "rodovia" that pulled local traffic.
UPDATE sources SET url =
  'https://news.google.com/rss/search?q=DNIT%20OR%20%22obras%20de%20arte%20especiais%22%20OR%20%22infraestrutura%20rodovi%C3%A1ria%22%20OR%20%22concess%C3%B5es%20rodovi%C3%A1rias%22%20OR%20viaduto&hl=pt-BR&gl=BR&ceid=BR:pt-419'
WHERE name = 'Google News — Rodovias/DNIT';

-- Reinforce energy/oil&gas with a working specialized outlet (validated).
INSERT INTO sources (name, url, type, active) VALUES
  ('Petronotícias', 'https://petronoticias.com.br/feed/', 'rss', true)
ON CONFLICT (url) DO NOTHING;

-- Re-evaluate Canal Energia: its 403 was against a test bot; our server uses a
-- browser User-Agent and may succeed. Re-activate and let production diagnostics
-- decide — deactivate manually if it keeps failing.
UPDATE sources SET active = true WHERE name = 'Canal Energia';
