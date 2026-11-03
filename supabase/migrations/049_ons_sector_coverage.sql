-- 049: cobertura setorial da ONS e da CCEE. O gabarito de outubro (510
-- manchetes do clipping da ONS) mostrou 84 coletadas e 39 marcadas: materia
-- de setor sem citar o cliente nao entrava. Fonte tematica soma +1 e a materia
-- entra como 'revisao' (visivel, nao confirmada), como no clipping que o
-- cliente recebe: bloco do cliente e bloco "setor".

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode) VALUES
  ('Zero Hora (GZH) — energia via Google News', 'https://news.google.com/rss/search?q=site%3Agauchazh.clicrbs.com.br%20%28energia%20OR%20%22setor%20el%C3%A9trico%22%20OR%20ONS%20OR%20Aneel%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 75, 'imprensa', 'referencia'),
  ('G1 Jornal Nacional — energia via Google News', 'https://news.google.com/rss/search?q=site%3Ag1.globo.com/jornal-nacional%20%28energia%20OR%20apag%C3%A3o%20OR%20%22setor%20el%C3%A9trico%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', true, false, 75, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = TRUE;

-- Brasil Energia (16 manchetes no gabarito): site responde 403 a acesso automatizado
-- e o Google News nao indexa. Fica registrado como sem cobertura; nao contornar.

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 80, TRUE
FROM clients client
CROSS JOIN sources source
WHERE client.name IN ('ONS', 'CCEE')
  AND source.active
  AND source.name IN (
    'MegaWhat (domínio atual)', 'Cenário Energia', 'Agência iNFRA', 'Canal Energia',
    'Petronotícias', 'Google News — Energia — temas de operação e mercado',
    'Google News — Energia — comercialização e preços', 'Google News — Gás Natural',
    'Institucional — ANEEL', 'Institucional — MME', 'Institucional — EPE',
    'Zero Hora (GZH) — energia via Google News', 'G1 Jornal Nacional — energia via Google News'
  )
ON CONFLICT (client_id, source_id) DO UPDATE SET is_thematic = TRUE, priority = EXCLUDED.priority;

-- Manchetes gerais do Brasil nao servem a nenhum relatorio e enchem a tela de Noticias.
UPDATE sources SET active = FALSE WHERE name = 'Google News — Brasil (manchetes)';
