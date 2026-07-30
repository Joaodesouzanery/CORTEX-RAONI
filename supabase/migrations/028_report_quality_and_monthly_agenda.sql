-- 028: funil editorial confiável, verificação independente e agenda mensal.
-- Idempotente. Não altera snapshots de relatórios já aprovados.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- A confiança da regra de captura (`confidence`) não é a mesma coisa que a
-- confiança editorial necessária para usar uma matéria como evidência.
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS editorial_confidence NUMERIC(4,3);
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS geographic_scope TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS quality_flags JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS adjudication_version INTEGER;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS qa_source TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS qa_checked_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_editorial_confidence_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_editorial_confidence_check
      CHECK (editorial_confidence IS NULL OR
        (editorial_confidence >= 0 AND editorial_confidence <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_geographic_scope_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_geographic_scope_check
      CHECK (geographic_scope IS NULL OR geographic_scope IN (
        'para', 'amazonia', 'brasil', 'internacional', 'indeterminado'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_qa_source_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_qa_source_check
      CHECK (qa_source IS NULL OR qa_source IN ('regra', 'ia', 'humano'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS act_qualification_funnel_idx
  ON article_client_tags(
    client_id,
    report_role,
    editorial_review_state,
    verification_status,
    editorial_confidence DESC,
    article_id
  );

CREATE INDEX IF NOT EXISTS act_quality_flags_gin_idx
  ON article_client_tags USING GIN (quality_flags);

-- "Mineração" isolada continua útil para captura, mas deixa de parecer uma
-- confirmação editorial. Regras contextuais fortes identificam o núcleo do
-- SIMINERAL; ambiguidades conhecidas nem chegam ao universo do cliente.
UPDATE client_relevance_rules AS rule
SET
  weight = 2,
  label = 'mineração ampla — candidata para triagem',
  excluded_terms = ARRAY[
    'mineração de criptomoedas', 'bitcoin', 'ethereum', 'Ibovespa',
    'carteira recomendada', 'dividendos', 'day trade'
  ],
  version = GREATEST(rule.version, 3),
  updated_at = NOW()
FROM clients client
WHERE rule.client_id = client.id
  AND client.name = 'SIMINERAL'
  AND rule.label = 'mineração nacional'
  AND NOT EXISTS (
    SELECT 1
    FROM client_relevance_rules existing
    WHERE existing.client_id = rule.client_id
      AND existing.label = 'mineração ampla — candidata para triagem'
  );

-- Se uma execução anterior ou ajuste manual já criou o novo rótulo, mantenha
-- apenas essa versão ativa em vez de colidir com a restrição única.
UPDATE client_relevance_rules AS rule
SET active = FALSE, updated_at = NOW()
FROM clients client
WHERE rule.client_id = client.id
  AND client.name = 'SIMINERAL'
  AND rule.label = 'mineração nacional'
  AND EXISTS (
    SELECT 1
    FROM client_relevance_rules existing
    WHERE existing.client_id = rule.client_id
      AND existing.label = 'mineração ampla — candidata para triagem'
  );

UPDATE client_relevance_rules AS rule
SET
  weight = 2,
  excluded_terms = ARRAY[
    'mineração de criptomoedas', 'bitcoin', 'ethereum', 'Ibovespa',
    'carteira recomendada', 'dividendos', 'day trade'
  ],
  version = GREATEST(rule.version, 3),
  active = TRUE,
  updated_at = NOW()
FROM clients client
WHERE rule.client_id = client.id
  AND client.name = 'SIMINERAL'
  AND rule.label = 'mineração ampla — candidata para triagem';

INSERT INTO client_relevance_rules (
  client_id, label, match_type, required_groups, excluded_terms, weight, version
)
SELECT
  client.id,
  seed.label,
  'setorial',
  seed.required_groups::JSONB,
  seed.excluded_terms::TEXT[],
  seed.weight,
  3
FROM clients client
CROSS JOIN (
  VALUES
    (
      'mineração no Pará e Carajás',
      '[["mineração","indústria mineral","lavra","mineradora","mineral"],["mineração no Pará","setor mineral do Pará","Carajás","Parauapebas","Canaã dos Carajás","Oriximiná","Juruti","Barcarena"]]',
      ARRAY['mineração de criptomoedas'],
      6
    ),
    (
      'mineração e Amazônia',
      '[["mineração","indústria mineral","lavra","mineradora"],["Amazônia","bioma amazônico","Carajás"]]',
      ARRAY['mineração de criptomoedas'],
      5
    ),
    (
      'mineração e sustentabilidade',
      '[["mineração","indústria mineral","mineradora"],["sustentabilidade","licenciamento ambiental","biodiversidade","comunidades","descarbonização"]]',
      ARRAY['mineração de criptomoedas'],
      5
    ),
    (
      'regulação de cavidades',
      '[["cavidade","cavidades","caverna","espeleologia"],["mineração","mineral","MME","Alexandre Silveira","decreto"]]',
      ARRAY[]::TEXT[],
      5
    ),
    (
      'minerais críticos com impacto brasileiro',
      '[["minerais críticos","minerais estratégicos","terras raras","lítio","níquel","cobre"],["Brasil","Pará","Amazônia","MME","ANM","BNDES","governo federal"]]',
      ARRAY['ETF', 'carteira recomendada', 'cotação'],
      5
    )
) AS seed(label, required_groups, excluded_terms, weight)
WHERE client.name = 'SIMINERAL'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight,
  version = EXCLUDED.version,
  active = TRUE,
  updated_at = NOW();

ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS quality_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS quality_summary JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_quality_status_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_quality_status_check
      CHECK (quality_status IN ('pending', 'running', 'passed', 'blocked'));
  END IF;
END $$;

-- Os tópicos pertencem a uma versão da preparação. Assim, uma nova versão pode
-- evoluir a pauta sem reescrever a agenda do relatório já aprovado.
CREATE TABLE IF NOT EXISTS monthly_report_topics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id            UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  position            INTEGER NOT NULL,
  title               TEXT NOT NULL,
  rationale           TEXT NOT NULL DEFAULT '',
  inclusion_terms     JSONB NOT NULL DEFAULT '[]'::JSONB,
  exclusion_terms     JSONB NOT NULL DEFAULT '[]'::JSONB,
  required            BOOLEAN NOT NULL DEFAULT TRUE,
  coverage_status     TEXT NOT NULL DEFAULT 'unchecked',
  gap_reason          TEXT,
  gap_acknowledged_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, position)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_topics_coverage_check') THEN
    ALTER TABLE monthly_report_topics ADD CONSTRAINT monthly_report_topics_coverage_check
      CHECK (coverage_status IN ('unchecked', 'searching', 'covered', 'gap', 'review'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_report_topics_draft_idx
  ON monthly_report_topics(draft_id, position);
ALTER TABLE monthly_report_topics ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_topic_evidence (
  topic_id         UUID NOT NULL REFERENCES monthly_report_topics(id) ON DELETE CASCADE,
  article_id       UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source           TEXT NOT NULL DEFAULT 'regra',
  confidence       NUMERIC(4,3),
  reason           TEXT,
  human_confirmed  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (topic_id, article_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_topic_evidence_source_check') THEN
    ALTER TABLE report_topic_evidence ADD CONSTRAINT report_topic_evidence_source_check
      CHECK (source IN ('regra', 'ia', 'humano'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_topic_evidence_confidence_check') THEN
    ALTER TABLE report_topic_evidence ADD CONSTRAINT report_topic_evidence_confidence_check
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_topic_evidence_article_idx
  ON report_topic_evidence(article_id, topic_id);
ALTER TABLE report_topic_evidence ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS topic_search_runs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id       UUID NOT NULL REFERENCES monthly_report_topics(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending',
  query_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  matched_count  INTEGER NOT NULL DEFAULT 0,
  linked_count   INTEGER NOT NULL DEFAULT 0,
  fetch_run_id   UUID REFERENCES fetch_runs(id) ON DELETE SET NULL,
  error          TEXT,
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'topic_search_runs_status_check') THEN
    ALTER TABLE topic_search_runs ADD CONSTRAINT topic_search_runs_status_check
      CHECK (status IN ('pending', 'searching', 'complete', 'gap', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS topic_search_runs_topic_idx
  ON topic_search_runs(topic_id, created_at DESC);
ALTER TABLE topic_search_runs ENABLE ROW LEVEL SECURITY;

-- Cada execução dos portões fica registrada; o resumo corrente também é
-- mantido no rascunho para leitura rápida no Painel.
CREATE TABLE IF NOT EXISTS report_quality_checks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id    UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  base_version INTEGER NOT NULL,
  status      TEXT NOT NULL,
  checks      JSONB NOT NULL,
  summary     JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_quality_checks_status_check') THEN
    ALTER TABLE report_quality_checks ADD CONSTRAINT report_quality_checks_status_check
      CHECK (status IN ('passed', 'blocked'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_quality_checks_draft_idx
  ON report_quality_checks(draft_id, created_at DESC);
ALTER TABLE report_quality_checks ENABLE ROW LEVEL SECURITY;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS agenda_snapshot JSONB;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS quality_snapshot JSONB;

-- Agenda inicial acordada para o SIMINERAL em julho de 2026. O INSERT só atua
-- em preparações já existentes e nunca substitui tópicos criados pelo usuário.
INSERT INTO monthly_report_topics (
  draft_id, position, title, rationale, inclusion_terms, exclusion_terms
)
SELECT
  d.id,
  seed.position,
  seed.title,
  seed.rationale,
  seed.inclusion_terms::JSONB,
  seed.exclusion_terms::JSONB
FROM monthly_report_drafts d
JOIN clients c ON c.id = d.client_id
CROSS JOIN (
  VALUES
    (
      1,
      'Decreto e regulação de cavidades',
      'Acompanhar o marco de cavidades naturais, inclusive declarações de Alexandre Silveira.',
      '["cavidade", "cavidades", "caverna", "espeleologia", "Alexandre Silveira"]',
      '[]'
    ),
    (
      2,
      'Minerais críticos e estratégicos',
      'Política, investimentos, cadeias produtivas e posicionamento do Brasil e do Pará.',
      '["minerais críticos", "minerais estratégicos", "terras raras", "lítio", "níquel", "cobre"]',
      '["ETF", "carteira recomendada"]'
    ),
    (
      3,
      'Mineração e sustentabilidade',
      'Licenciamento, clima, biodiversidade, comunidades, descarbonização e legado.',
      '["mineração", "sustentabilidade", "licenciamento ambiental", "biodiversidade", "comunidades"]',
      '["criptomoeda"]'
    ),
    (
      4,
      'Mineração e Amazônia',
      'Impactos, oportunidades, governança e desenvolvimento mineral na Amazônia.',
      '["mineração", "Amazônia", "bioma amazônico", "Carajás"]',
      '["mineração de criptomoedas"]'
    ),
    (
      5,
      'Mineração no Pará',
      'Operações, regulação, investimentos, municípios e desenvolvimento do setor mineral paraense.',
      '["mineração no Pará", "setor mineral do Pará", "Carajás", "Parauapebas", "Canaã dos Carajás", "Oriximiná", "Juruti"]',
      '[]'
    )
) AS seed(position, title, rationale, inclusion_terms, exclusion_terms)
WHERE c.name = 'SIMINERAL'
  AND d.period_month = DATE '2026-07-01'
  AND NOT EXISTS (
    SELECT 1 FROM monthly_report_topics existing WHERE existing.draft_id = d.id
  );
