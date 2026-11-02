-- 043: agenda regulatoria dentro do sistema e limpeza achada no teste SIMINERAL.

CREATE TABLE IF NOT EXISTS regulatory_agenda_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agency       TEXT NOT NULL,
  title        TEXT NOT NULL,
  item_type    TEXT NOT NULL,
  phase        TEXT,
  -- NULL e legitimo: prazo so entra quando consta na fonte oficial.
  deadline     DATE,
  official_url TEXT NOT NULL,
  client_names TEXT[] NOT NULL DEFAULT '{}',
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agency, official_url, title)
);
CREATE INDEX IF NOT EXISTS regulatory_agenda_items_deadline_idx
  ON regulatory_agenda_items(deadline);
ALTER TABLE regulatory_agenda_items ENABLE ROW LEVEL SECURITY;

-- "mineracao de dados" casava a regra ampla: entrou matéria de videogame no SIMINERAL.
-- Regra direta segue sem exclusao, mesmo contrato das demais.
UPDATE client_relevance_rules rule
SET excluded_terms = (
      SELECT ARRAY(SELECT DISTINCT unnest(rule.excluded_terms || ARRAY[
        'mineração de dados', 'mineração de criptomoedas', 'mineração de bitcoin'
      ]))
    ),
    updated_at = NOW()
FROM clients client
WHERE client.id = rule.client_id
  AND client.name = 'SIMINERAL'
  AND rule.match_type <> 'direta';

-- Sem itens no Google News e site sem resposta em 02/11/2026. Reative se voltarem.
UPDATE sources SET active = FALSE
WHERE name IN (
  'Revista Portuária — via Google News',
  'Energia Hoje — via Google News',
  'NTC&Logística — via Google News'
);
