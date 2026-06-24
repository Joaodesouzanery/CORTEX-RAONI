-- 006: broaden source coverage for the non-energy clients (DNIT aquaviária/
-- rodoviária, SindInfor/software-MG, mineração) plus reinforce energy themes.
-- Uses Google News RSS per theme — reliable, returns ~50 recent items, and
-- guarantees thematic coverage that the general/energy feeds lack.
-- Idempotent: ensures the unique constraint on url, then ON CONFLICT (url) DO NOTHING.

-- The table from 001 declares url UNIQUE, but guard in case it was created
-- manually without it (same precaution as the clients seed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'sources'::regclass AND contype = 'u' AND conname = 'sources_url_key'
  ) THEN
    ALTER TABLE sources ADD CONSTRAINT sources_url_key UNIQUE (url);
  END IF;
END $$;

INSERT INTO sources (name, url, type, active) VALUES
(
  'Google News — Aquaviário/Hidrovias',
  'https://news.google.com/rss/search?q=hidrovia%20OR%20dragagem%20OR%20%22porto%20fluvial%22%20OR%20hidrovi%C3%A1rio&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — Rodovias/DNIT',
  'https://news.google.com/rss/search?q=DNIT%20OR%20rodovia%20OR%20viaduto%20OR%20%22obras%20de%20arte%20especiais%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — Software/TI',
  'https://news.google.com/rss/search?q=%22ind%C3%BAstria%20de%20software%22%20OR%20%22tecnologia%20da%20informa%C3%A7%C3%A3o%22%20OR%20Sindinfor&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — Mineração',
  'https://news.google.com/rss/search?q=minera%C3%A7%C3%A3o%20OR%20%22minerais%20cr%C3%ADticos%22%20OR%20%22terras%20raras%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — Gás Natural',
  'https://news.google.com/rss/search?q=%22g%C3%A1s%20natural%22%20OR%20termel%C3%A9trica%20OR%20%22gera%C3%A7%C3%A3o%20t%C3%A9rmica%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — CCEE/Mercado de Energia',
  'https://news.google.com/rss/search?q=CCEE%20OR%20%22comercializa%C3%A7%C3%A3o%20de%20energia%22%20OR%20%22mercado%20livre%20de%20energia%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
),
(
  'Google News — ONS/Setor Elétrico',
  'https://news.google.com/rss/search?q=%22Operador%20Nacional%20do%20Sistema%20El%C3%A9trico%22%20OR%20%22setor%20el%C3%A9trico%22&hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
)
ON CONFLICT (url) DO NOTHING;
