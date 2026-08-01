-- 030: preparação mensal contínua, memória editorial e automação retomável.
-- Idempotente. Depende das migrations 029 e anteriores.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS client_editorial_profiles (
  client_id             UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  version               INTEGER NOT NULL DEFAULT 1,
  permanent_axes        JSONB NOT NULL DEFAULT '[]'::JSONB,
  inclusion_guidelines  TEXT NOT NULL DEFAULT '',
  exclusion_guidelines  TEXT NOT NULL DEFAULT '',
  style_guidelines      TEXT NOT NULL DEFAULT '',
  default_posture       TEXT NOT NULL DEFAULT 'consultivo_cauteloso',
  active                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE client_editorial_profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS client_editorial_profile_versions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  snapshot    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, version)
);
CREATE INDEX IF NOT EXISTS client_editorial_profile_versions_client_idx
  ON client_editorial_profile_versions(client_id, version DESC);
ALTER TABLE client_editorial_profile_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS client_report_topic_templates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,
  title             TEXT NOT NULL,
  rationale         TEXT NOT NULL DEFAULT '',
  inclusion_terms   JSONB NOT NULL DEFAULT '[]'::JSONB,
  exclusion_terms   JSONB NOT NULL DEFAULT '[]'::JSONB,
  required          BOOLEAN NOT NULL DEFAULT TRUE,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, position),
  UNIQUE (client_id, title)
);
CREATE INDEX IF NOT EXISTS client_report_topic_templates_client_idx
  ON client_report_topic_templates(client_id, active, position);
ALTER TABLE client_report_topic_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS client_editorial_memory_items (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  article_id    UUID REFERENCES articles(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  source        TEXT NOT NULL,
  topic         TEXT,
  reason        TEXT NOT NULL DEFAULT '',
  snapshot      JSONB NOT NULL DEFAULT '{}'::JSONB,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_memory_kind_check') THEN
    ALTER TABLE client_editorial_memory_items ADD CONSTRAINT editorial_memory_kind_check
      CHECK (kind IN ('evidencia', 'contexto', 'ruido', 'estilo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_memory_source_check') THEN
    ALTER TABLE client_editorial_memory_items ADD CONSTRAINT editorial_memory_source_check
      CHECK (source IN ('humano', 'relatorio_aprovado', 'curado'));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS editorial_memory_article_unique_idx
  ON client_editorial_memory_items(client_id, article_id, kind);
CREATE INDEX IF NOT EXISTS editorial_memory_selection_idx
  ON client_editorial_memory_items(client_id, kind, active, updated_at DESC);
ALTER TABLE client_editorial_memory_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS base_digest TEXT;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS comparison_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS change_summary JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS editorial_memory_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS automation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS automation_updated_at TIMESTAMPTZ;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS claude_package_base_version INTEGER;
ALTER TABLE monthly_report_drafts ADD COLUMN IF NOT EXISTS claude_package_generated_at TIMESTAMPTZ;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_automation_status_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_automation_status_check
      CHECK (automation_status IN ('pending', 'running', 'waiting_configuration', 'complete', 'partial', 'error'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS report_base_revisions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id        UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  from_version    INTEGER NOT NULL,
  to_version      INTEGER NOT NULL,
  previous_digest TEXT,
  current_digest  TEXT NOT NULL,
  added           JSONB NOT NULL DEFAULT '[]'::JSONB,
  removed         JSONB NOT NULL DEFAULT '[]'::JSONB,
  reclassified    JSONB NOT NULL DEFAULT '[]'::JSONB,
  content_changed JSONB NOT NULL DEFAULT '[]'::JSONB,
  bucket_changes  JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, to_version)
);
ALTER TABLE report_base_revisions ADD COLUMN IF NOT EXISTS content_changed JSONB NOT NULL DEFAULT '[]'::JSONB;
CREATE INDEX IF NOT EXISTS report_base_revisions_draft_idx
  ON report_base_revisions(draft_id, to_version DESC);
ALTER TABLE report_base_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_review_checkpoints (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id      UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  base_version  INTEGER NOT NULL,
  base_digest   TEXT,
  snapshot      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS report_review_checkpoints_draft_idx
  ON report_review_checkpoints(draft_id, created_at DESC);
ALTER TABLE report_review_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_clusters (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id                  UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  cluster_key               TEXT NOT NULL,
  label                     TEXT NOT NULL,
  representative_article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  article_count             INTEGER NOT NULL DEFAULT 0,
  vehicle_count             INTEGER NOT NULL DEFAULT 0,
  direct_mentions           INTEGER NOT NULL DEFAULT 0,
  tone                      TEXT,
  confidence                NUMERIC(4,3),
  suggested_role            TEXT,
  suggestion_reason         TEXT,
  human_role                TEXT,
  human_label               TEXT,
  human_decided_at          TIMESTAMPTZ,
  article_ids               JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, cluster_key)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_clusters_suggested_role_check') THEN
    ALTER TABLE report_clusters ADD CONSTRAINT report_clusters_suggested_role_check
      CHECK (suggested_role IS NULL OR suggested_role IN ('evidencia', 'contexto', 'ruido'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_clusters_human_role_check') THEN
    ALTER TABLE report_clusters ADD CONSTRAINT report_clusters_human_role_check
      CHECK (human_role IS NULL OR human_role IN ('evidencia', 'contexto', 'ruido'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_clusters_draft_idx
  ON report_clusters(draft_id, article_count DESC, cluster_key);
ALTER TABLE report_clusters ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_lead_suggestions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id    UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  base_version INTEGER NOT NULL,
  article_id  UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  rank        INTEGER NOT NULL,
  score       NUMERIC(7,2) NOT NULL,
  rationale   TEXT NOT NULL,
  snapshot    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, base_version, rank),
  UNIQUE (draft_id, base_version, article_id)
);
CREATE INDEX IF NOT EXISTS report_lead_suggestions_draft_idx
  ON report_lead_suggestions(draft_id, base_version DESC, rank);
ALTER TABLE report_lead_suggestions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_automation_runs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger        TEXT NOT NULL,
  period_month   DATE NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at     TIMESTAMPTZ,
  finished_at    TIMESTAMPTZ,
  total_jobs     INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  failed_jobs    INTEGER NOT NULL DEFAULT 0,
  error          TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS report_automation_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id          UUID NOT NULL REFERENCES report_automation_runs(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  draft_id        UUID REFERENCES monthly_report_drafts(id) ON DELETE SET NULL,
  period_month    DATE NOT NULL,
  stage           TEXT NOT NULL DEFAULT 'ensure_draft',
  status          TEXT NOT NULL DEFAULT 'pending',
  cursor          JSONB NOT NULL DEFAULT '{}'::JSONB,
  attempts        INTEGER NOT NULL DEFAULT 0,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  changed_count   INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  available_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at       TIMESTAMPTZ,
  started_at      TIMESTAMPTZ,
  finished_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, client_id, period_month)
);
ALTER TABLE report_automation_jobs ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_automation_runs_trigger_check') THEN
    ALTER TABLE report_automation_runs ADD CONSTRAINT report_automation_runs_trigger_check
      CHECK (trigger IN ('schedule', 'manual', 'backfill'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_automation_run_status_check') THEN
    ALTER TABLE report_automation_runs ADD CONSTRAINT report_automation_run_status_check
      CHECK (status IN ('pending', 'running', 'complete', 'partial', 'error'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_automation_job_status_check') THEN
    ALTER TABLE report_automation_jobs ADD CONSTRAINT report_automation_job_status_check
      CHECK (status IN ('pending', 'running', 'waiting_configuration', 'complete', 'error'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_automation_jobs_claim_idx
  ON report_automation_jobs(status, available_at, created_at)
  WHERE status IN ('pending', 'running');
ALTER TABLE report_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS operational_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint     TEXT NOT NULL UNIQUE,
  kind            TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'warning',
  status          TEXT NOT NULL DEFAULT 'open',
  client_id       UUID REFERENCES clients(id) ON DELETE CASCADE,
  source_id       UUID REFERENCES sources(id) ON DELETE CASCADE,
  draft_id        UUID REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  details         JSONB NOT NULL DEFAULT '{}'::JSONB,
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_alert_status_check') THEN
    ALTER TABLE operational_alerts ADD CONSTRAINT operational_alert_status_check
      CHECK (status IN ('open', 'acknowledged', 'resolved'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS operational_alerts_open_idx
  ON operational_alerts(status, severity, last_seen_at DESC)
  WHERE status <> 'resolved';
ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;

-- Claim atômico: dois consumidores nunca recebem o mesmo trabalho.
CREATE OR REPLACE FUNCTION claim_report_automation_job()
RETURNS SETOF report_automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE selected_id UUID;
BEGIN
  SELECT id INTO selected_id
  FROM report_automation_jobs
  WHERE (
    status = 'pending'
    OR (status = 'running' AND locked_at < NOW() - INTERVAL '10 minutes')
  )
    AND available_at <= NOW()
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF selected_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  UPDATE report_automation_jobs
  SET status = 'running', locked_at = NOW(), started_at = COALESCE(started_at, NOW()),
      attempts = attempts + 1, updated_at = NOW()
  WHERE id = selected_id
  RETURNING *;
END;
$$;
REVOKE ALL ON FUNCTION claim_report_automation_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_report_automation_job() TO service_role;

-- Memória inicial: apenas decisões humanas já revisadas e evidências de
-- versões aprovadas. Classificações exclusivamente da IA não são aprendidas.
INSERT INTO client_editorial_memory_items (
  client_id, article_id, kind, source, topic, reason, snapshot
)
SELECT
  tag.client_id,
  tag.article_id,
  COALESCE(tag.report_role, 'contexto'),
  'humano',
  tag.tema,
  COALESCE(tag.editorial_reason, 'Decisão humana revisada.'),
  jsonb_build_object(
    'title', article.title,
    'publisher', article.publisher,
    'geographic_scope', tag.geographic_scope,
    'relevancia', tag.relevancia
  )
FROM article_client_tags tag
JOIN articles article ON article.id = tag.article_id
WHERE (tag.report_role_source = 'humano' OR tag.editorial_review_state = 'revisado')
  AND tag.report_role IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO client_editorial_memory_items (
  client_id, article_id, kind, source, topic, reason, snapshot
)
SELECT
  draft.client_id,
  evidence.article_id,
  'evidencia',
  'relatorio_aprovado',
  evidence.classification_snapshot->>'tema',
  COALESCE(evidence.classification_snapshot->>'editorial_reason', 'Evidência usada em relatório aprovado.'),
  jsonb_build_object(
    'article', evidence.article_snapshot,
    'classification', evidence.classification_snapshot,
    'draft_id', draft.id,
    'period_month', draft.period_month,
    'version', draft.version
  )
FROM monthly_report_drafts draft
JOIN report_evidence_items evidence ON evidence.draft_id = draft.id
WHERE draft.status = 'approved'
  AND evidence.bucket = 'qualified'
ON CONFLICT DO NOTHING;

INSERT INTO client_editorial_profiles (
  client_id, permanent_axes, inclusion_guidelines, exclusion_guidelines, style_guidelines
)
SELECT
  id,
  CASE name
    WHEN 'SIMINERAL' THEN '["Pará", "Amazônia", "indústria mineral", "desenvolvimento sustentável"]'::JSONB
    WHEN 'ONS' THEN '["segurança do SIN", "operação elétrica", "planejamento e transição energética"]'::JSONB
    WHEN 'CCEE' THEN '["comercialização de energia", "mercado livre", "liquidação e preços"]'::JSONB
    WHEN 'SINDINFOR' THEN '["indústria de software", "economia digital", "Minas Gerais"]'::JSONB
    ELSE '["infraestrutura aquaviária", "hidrovias", "navegação"]'::JSONB
  END,
  COALESCE(context, ''),
  'Excluir coincidências lexicais, consumo sem impacto setorial e fatos sem relação estratégica demonstrável.',
  COALESCE(report_prompt, '')
FROM clients
WHERE active = TRUE
ON CONFLICT (client_id) DO UPDATE SET
  permanent_axes = CASE WHEN client_editorial_profiles.permanent_axes = '[]'::JSONB THEN EXCLUDED.permanent_axes ELSE client_editorial_profiles.permanent_axes END,
  inclusion_guidelines = CASE WHEN client_editorial_profiles.inclusion_guidelines = '' THEN EXCLUDED.inclusion_guidelines ELSE client_editorial_profiles.inclusion_guidelines END,
  style_guidelines = CASE WHEN client_editorial_profiles.style_guidelines = '' THEN EXCLUDED.style_guidelines ELSE client_editorial_profiles.style_guidelines END,
  updated_at = NOW();

INSERT INTO client_editorial_profile_versions (client_id, version, snapshot)
SELECT
  client_id,
  version,
  jsonb_build_object(
    'permanent_axes', permanent_axes,
    'inclusion_guidelines', inclusion_guidelines,
    'exclusion_guidelines', exclusion_guidelines,
    'style_guidelines', style_guidelines,
    'default_posture', default_posture,
    'active', active
  )
FROM client_editorial_profiles
ON CONFLICT (client_id, version) DO NOTHING;

INSERT INTO client_report_topic_templates (
  client_id, position, title, rationale, inclusion_terms, exclusion_terms
)
SELECT client.id, seed.position, seed.title, seed.rationale,
       seed.inclusion_terms::JSONB, seed.exclusion_terms::JSONB
FROM clients client
JOIN (
  VALUES
    ('SIMINERAL', 1, 'Regulação de cavidades', 'Impactos regulatórios para a mineração.', '["cavidade","cavidades","espeleologia","Alexandre Silveira"]', '[]'),
    ('SIMINERAL', 2, 'Minerais críticos e estratégicos', 'Competitividade, investimentos e política mineral.', '["minerais críticos","minerais estratégicos","terras raras","lítio"]', '["ETF","cotação"]'),
    ('SIMINERAL', 3, 'Mineração e sustentabilidade', 'Licenciamento, comunidades, biodiversidade e descarbonização.', '["mineração","sustentabilidade","licenciamento","comunidades"]', '["mineração de criptomoedas"]'),
    ('SIMINERAL', 4, 'Mineração e Amazônia', 'Impacto e posicionamento no bioma amazônico.', '["mineração","Amazônia","Carajás"]', '["mineração de criptomoedas"]'),
    ('SIMINERAL', 5, 'Mineração no Pará', 'Atividade, regulação e desenvolvimento no Pará.', '["mineração no Pará","Carajás","Parauapebas","Canaã dos Carajás"]', '["mineração de criptomoedas"]'),
    ('ONS', 1, 'Segurança e operação do SIN', 'Ocorrências, recomposição, carga e confiabilidade.', '["ONS","SIN","Sistema Interligado Nacional","operação"]', '["on sale"]'),
    ('ONS', 2, 'Planejamento, regulação e custos', 'Decisões que afetam o papel técnico do Operador.', '["ONS","EPE","Aneel","planejamento elétrico"]', '[]'),
    ('ONS', 3, 'Geração, transmissão e curtailment', 'Oferta, rede, armazenamento e restrições operativas.', '["curtailment","transmissão","geração","baterias"]', '[]'),
    ('CCEE', 1, 'Mercado livre, PLD e liquidação', 'Dinâmica da comercialização e preços.', '["CCEE","PLD","liquidação","mercado livre"]', '[]'),
    ('CCEE', 2, 'Leilões e contratação de energia', 'Contratação, expansão e mecanismos de mercado.', '["leilão de energia","contratação","CCEE"]', '[]'),
    ('CCEE', 3, 'Regulação da comercialização', 'Regras com impacto para agentes e consumidores.', '["comercialização de energia","Aneel","MME"]', '[]'),
    ('DAQ — Diretoria de Infraestrutura Aquaviária/DNIT', 1, 'Hidrovias, dragagem e eclusas', 'Infraestrutura aquaviária sob responsabilidade federal.', '["hidrovia","dragagem","eclusa","DAQ"]', '["rodovia","asfalto"]'),
    ('DAQ — Diretoria de Infraestrutura Aquaviária/DNIT', 2, 'Portos e navegação interior', 'Integração logística e transporte aquaviário.', '["porto","navegação interior","transporte aquaviário"]', '["ponte rodoviária"]'),
    ('DAQ — Diretoria de Infraestrutura Aquaviária/DNIT', 3, 'Orçamento, licenciamento e obras', 'Condições institucionais para execução da agenda aquaviária.', '["DNIT","orçamento","licenciamento","obra aquaviária"]', '["obra rodoviária"]'),
    ('SINDINFOR', 1, 'Software e economia digital', 'Ambiente nacional e mineiro da indústria de software.', '["software","economia digital","SINDINFOR"]', '["smartphone","videogame"]'),
    ('SINDINFOR', 2, 'Tributação, trabalho e qualificação', 'Custos, talentos e competitividade do setor.', '["software","tributação","trabalho","qualificação"]', '[]'),
    ('SINDINFOR', 3, 'IA, inovação e regulação digital', 'Políticas e tecnologias com impacto empresarial.', '["inteligência artificial","regulação digital","inovação"]', '["filtro de foto"]')
) AS seed(client_name, position, title, rationale, inclusion_terms, exclusion_terms)
  ON seed.client_name = client.name
WHERE client.active = TRUE
ON CONFLICT DO NOTHING;

UPDATE client_editorial_profile_versions version
SET snapshot = version.snapshot || jsonb_build_object(
  'topics', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', topic.id,
        'position', topic.position,
        'title', topic.title,
        'rationale', topic.rationale,
        'inclusion_terms', topic.inclusion_terms,
        'exclusion_terms', topic.exclusion_terms,
        'required', topic.required
      ) ORDER BY topic.position
    )
    FROM client_report_topic_templates topic
    WHERE topic.client_id = version.client_id AND topic.active = TRUE
  ), '[]'::JSONB)
)
WHERE version.version = 1
  AND NOT (version.snapshot ? 'topics');
