-- 061: fonte técnica do backfill de mês (src/lib/backfill.ts).
-- As matérias recuperadas de um mês passado (busca do Google News com
-- after:/before:) precisam de um source_id para o RPC ingest_source_articles.
-- A fonte fica INATIVA: a coleta normal não a lê; só /api/internal/backfill.
-- URL interna (cortex://) para nunca ser buscada por engano.
-- Idempotente.

INSERT INTO sources (name, url, type, active, is_general, priority, categoria, access_mode)
VALUES ('Google News — backfill de mês (busca por período)', 'cortex://backfill-google-news', 'rss', false, false, 50, 'imprensa', 'referencia')
ON CONFLICT (url) DO UPDATE SET name = EXCLUDED.name, active = false;

NOTIFY pgrst, 'reload schema';
