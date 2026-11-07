-- Fontes cadastradas no banco, com situação da última coleta.
-- O SQL Editor mostra no máximo 100 linhas: ajuste o OFFSET (0, 100, 200…).
SELECT
  s.name,
  s.url,
  s.active,
  s.is_general,
  s.categoria,
  s.last_fetch_error,
  (SELECT string_agg(c.name, ' | ' ORDER BY c.name)
     FROM client_sources cs JOIN clients c ON c.id = cs.client_id
    WHERE cs.source_id = s.id) AS clientes
FROM sources s
ORDER BY s.active DESC, s.name
LIMIT 100 OFFSET 0;

-- Quantas matérias cada fonte trouxe em outubro/2026 (para ver quem rende).
SELECT s.name, COUNT(*) AS materias_outubro
FROM article_provenance ap
JOIN sources s ON s.id = ap.source_id
JOIN articles a ON a.id = ap.article_id
WHERE a.published_at >= '2026-10-01T03:00:00Z' AND a.published_at < '2026-11-01T03:00:00Z'
GROUP BY s.name
ORDER BY materias_outubro DESC
LIMIT 100 OFFSET 0;
