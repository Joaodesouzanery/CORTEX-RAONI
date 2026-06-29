-- 009: QA fixes for the source feeds (verified by fetching each one).
-- Fix the Poder360 redirect URL, deactivate dead feeds (404/403/empty/offline),
-- and add a general Google News headlines feed (aggregates G1/Folha/CNN/Estadão)
-- to recover the general coverage lost from the dead direct feeds. Idempotent.

UPDATE sources SET url = 'https://www.poder360.com.br/feed/' WHERE name = 'Poder360';

UPDATE sources SET active = false
WHERE name IN (
  'Estadão',
  'Agência Estado / Broadcast',
  'O Globo',
  'G1',
  'Brasil 247',
  'Canal Energia',
  'Brasil Energia',
  'MegaWhat'
);

INSERT INTO sources (name, url, type, active) VALUES
(
  'Google News — Brasil (manchetes)',
  'https://news.google.com/rss?hl=pt-BR&gl=BR&ceid=BR:pt-419',
  'rss', true
)
ON CONFLICT (url) DO NOTHING;
