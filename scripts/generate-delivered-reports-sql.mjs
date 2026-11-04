import { readFileSync } from 'node:fs'
const g = JSON.parse(readFileSync('docs/referencia-relatorios/gabarito.json', 'utf8'))
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const rows = []
const seen = new Set()
for (const r of g.reports) for (const i of r.items) if (!seen.has(r.file + "|" + i.title.slice(0, 500)) && seen.add(r.file + "|" + i.title.slice(0, 500)))
  rows.push(`(${q(r.client)}, ${q(r.period + '-01')}, ${q(r.variant)}, ${q(r.file)}, ${q(i.date)}, ${q(i.outlet)}, ${q(i.title.slice(0, 500))}, ${q(i.url)}, ${q(i.spokesperson)}, ${q(i.tone)})`)
console.log(`-- 052: contagens leves do hero, gabarito dos relatórios entregues e índices.
-- O hero de Notícias usava o /api/dashboard (9 contadores) e estourava
-- statement_timeout. O gabarito (docs/referencia-relatorios/gabarito.json,
-- extraído dos .dc.html entregues) vira tabela para medir a captura do Cortex.

CREATE INDEX IF NOT EXISTS articles_published_at_idx ON articles (published_at DESC);
CREATE INDEX IF NOT EXISTS article_client_tags_client_article_idx
  ON article_client_tags (client_id, article_id) WHERE monitoring_status <> 'excluido';

CREATE OR REPLACE FUNCTION news_hero_counts(p_start TIMESTAMPTZ)
RETURNS TABLE (client_id UUID, total BIGINT, direct BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '25s'
AS $$
  SELECT t.client_id,
         COUNT(*) FILTER (WHERE t.monitoring_status IN ('confirmado', 'candidato')),
         COUNT(*) FILTER (WHERE t.cita_cliente)
  FROM articles a
  JOIN article_client_tags t ON t.article_id = a.id
  WHERE a.published_at >= p_start AND t.monitoring_status <> 'excluido'
  GROUP BY t.client_id;
$$;
REVOKE ALL ON FUNCTION news_hero_counts(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION news_hero_counts(TIMESTAMPTZ) TO service_role;

CREATE TABLE IF NOT EXISTS delivered_report_items (
  id BIGSERIAL PRIMARY KEY,
  client_name TEXT NOT NULL,
  period_month DATE NOT NULL,
  variant TEXT NOT NULL,
  report_file TEXT NOT NULL,
  item_date DATE,
  outlet TEXT,
  title TEXT NOT NULL,
  url TEXT,
  spokesperson TEXT,
  tone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE delivered_report_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'delivered_report_items_unique') THEN
    ALTER TABLE delivered_report_items
      ADD CONSTRAINT delivered_report_items_unique UNIQUE (report_file, title);
  END IF;
END $$;

INSERT INTO delivered_report_items (client_name, period_month, variant, report_file, item_date, outlet, title, url, spokesperson, tone) VALUES
${rows.join(',\n')}
ON CONFLICT (report_file, title) DO UPDATE SET url = EXCLUDED.url, outlet = EXCLUDED.outlet, item_date = EXCLUDED.item_date;

NOTIFY pgrst, 'reload schema';`)
