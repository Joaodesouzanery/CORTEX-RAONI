-- 024: fontes prioritárias de referência e feeds temáticos dos cinco clientes.
-- As consultas do Google News entregam metadados/links; a íntegra só é marcada
-- como integral quando vem de página pública ou importação autorizada.

INSERT INTO sources (name, url, type, active, is_general, priority, access_mode) VALUES
  (
    'Valor Econômico — referência',
    'https://news.google.com/rss/search?q=site%3Avalor.globo.com&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, true, 90, 'referencia'
  ),
  (
    'Folha de S.Paulo — referência',
    'https://news.google.com/rss/search?q=site%3Afolha.uol.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, true, 90, 'referencia'
  ),
  (
    'CNN Brasil — referência',
    'https://news.google.com/rss/search?q=site%3Acnnbrasil.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, true, 85, 'referencia'
  ),
  (
    'CBN — referência',
    'https://news.google.com/rss/search?q=site%3Acbn.globo.com&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, true, 80, 'referencia'
  ),
  (
    'Google News — SIMINERAL/Mineração no Pará',
    'https://news.google.com/rss/search?q=%28SIMINERAL%20OR%20%22minera%C3%A7%C3%A3o%20no%20Par%C3%A1%22%20OR%20%22ind%C3%BAstria%20mineral%20paraense%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 100, 'publico'
  ),
  (
    'Google News — DAQ/DNIT Aquaviário',
    'https://news.google.com/rss/search?q=%28DAQ%20DNIT%20OR%20%22Diretoria%20de%20Infraestrutura%20Aquavi%C3%A1ria%22%20OR%20hidrovia%20OR%20dragagem%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 100, 'publico'
  ),
  (
    'Google News — SINDINFOR/Economia Digital MG',
    'https://news.google.com/rss/search?q=%28SINDINFOR%20OR%20%22ind%C3%BAstria%20de%20software%22%20OR%20%22economia%20digital%22%29%20%28MG%20OR%20%22Minas%20Gerais%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
    'rss', true, false, 100, 'publico'
  ),
  (
    'Institucional — DAQ/DNIT',
    'https://www.gov.br/dnit/pt-br/assuntos/aquaviario',
    'scrape', true, false, 100, 'publico'
  ),
  (
    'Institucional — SINDINFOR',
    'https://sindinfor.org.br/',
    'scrape', true, false, 100, 'publico'
  ),
  (
    'Institucional — SIMINERAL',
    'https://www.simineral.org.br/',
    'scrape', true, false, 100, 'publico'
  )
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  active = true,
  is_general = EXCLUDED.is_general,
  priority = EXCLUDED.priority,
  access_mode = EXCLUDED.access_mode;

UPDATE sources
SET categoria = 'institucional'
WHERE name IN (
  'Institucional — DAQ/DNIT',
  'Institucional — SINDINFOR',
  'Institucional — SIMINERAL'
);

-- Fontes temáticas: tudo que vier delas entra como candidato do cliente.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT c.id, s.id, 100, true
FROM clients c
JOIN sources s ON
  (c.name = 'SIMINERAL' AND s.name IN (
    'Google News — Mineração',
    'Google News — SIMINERAL/Mineração no Pará',
    'Mineração Brasil',
    'Institucional — ANM',
    'Institucional — SIMINERAL'
  ))
  OR (c.name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT' AND s.name IN (
    'Google News — Aquaviário/Hidrovias',
    'Google News — DAQ/DNIT Aquaviário',
    'Institucional — Antaq',
    'Institucional — DAQ/DNIT'
  ))
  OR (c.name = 'SINDINFOR' AND s.name IN (
    'Google News — Software/TI',
    'Google News — SINDINFOR/Economia Digital MG',
    'Institucional — SINDINFOR'
  ))
  OR (c.name = 'ONS' AND s.name IN (
    'Google News — ONS/Setor Elétrico',
    'Institucional — ONS'
  ))
  OR (c.name = 'CCEE' AND s.name IN (
    'Google News — CCEE/Mercado de Energia',
    'Institucional — CCEE'
  ))
ON CONFLICT (client_id, source_id) DO UPDATE SET
  priority = EXCLUDED.priority,
  is_thematic = true;

-- Veículos prioritários generalistas: só entram quando também casam com os
-- termos do cliente, por isso is_thematic=false.
INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT c.id, s.id, s.priority, false
FROM clients c
JOIN sources s ON s.name IN (
  'Valor Econômico — referência',
  'Folha de S.Paulo — referência',
  'CNN Brasil — referência',
  'CBN — referência',
  'G1',
  'O Globo',
  'Estadão'
)
WHERE c.active = true
ON CONFLICT (client_id, source_id) DO UPDATE SET
  priority = EXCLUDED.priority,
  is_thematic = false;
