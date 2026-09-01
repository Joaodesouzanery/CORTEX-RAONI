-- 032: relevance rules for the PRIO client (petróleo — antiga PetroRio).
-- The client row and its two Google News feeds (menção direta + setor E&P
-- offshore) were already created via the app's Clientes/Fontes UI/API.
-- client_relevance_rules has no UI yet, so it's seeded here, following the
-- same shape as CCEE/SIMINERAL in 025_news_qa_and_dashboard.sql.

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["PRIO","PetroRio","Petro Rio","PRIO3"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1
FROM clients WHERE name = 'PRIO'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type,
  required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight,
  version = EXCLUDED.version,
  active = TRUE;

-- Sectoral coverage: the company's own producing fields/assets, so news about
-- its business is captured even when a piece never names PRIO/PetroRio
-- directly (e.g. a well-level operational or regulatory story).
INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'campos e ativos offshore', 'setorial',
  '[["campo de Frade","campo de Polvo","campo de Wahoo","campo de Peroá","Albacora Leste","revitalização de campos maduros","exploração e produção offshore"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1
FROM clients WHERE name = 'PRIO'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type,
  required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight,
  version = EXCLUDED.version,
  active = TRUE;
