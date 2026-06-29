-- 012: bring the requested outlets back. Their direct RSS is dead/changed, so
-- route each through a Google News site-scoped feed (reliable). Reactivate +
-- point to the new URL. Idempotent (UPDATE by name).
-- Note: Google News links are obfuscated, so these feeds won't carry images
-- (images come from direct feeds).

UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:g1.globo.com&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'G1';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:oglobo.globo.com&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'O Globo';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:estadao.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'Estadão';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:estadao.com.br%20economia&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'Agência Estado / Broadcast';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:brasil247.com&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'Brasil 247';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:megawhat.energy&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'MegaWhat';
UPDATE sources SET active = true, url = 'https://news.google.com/rss/search?q=site:brasil-energia.com.br&hl=pt-BR&gl=BR&ceid=BR:pt-419'
  WHERE name = 'Brasil Energia';
