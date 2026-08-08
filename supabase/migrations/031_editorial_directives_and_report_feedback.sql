-- 031: diretivas editoriais estruturadas, feedback de cliente e captação orientada à cobertura.
-- Idempotente. Depende da migration 030.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS client_editorial_directives (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  directive_key      TEXT NOT NULL,
  category           TEXT NOT NULL,
  title              TEXT NOT NULL,
  instruction        TEXT NOT NULL,
  rationale          TEXT NOT NULL DEFAULT '',
  severity           TEXT NOT NULL DEFAULT 'prefer',
  scope              TEXT NOT NULL DEFAULT 'permanent',
  period_month       DATE,
  source             TEXT NOT NULL DEFAULT 'operador',
  phrase             TEXT,
  replacements       JSONB NOT NULL DEFAULT '[]'::JSONB,
  metric_visibility  TEXT,
  allow_literal_quote BOOLEAN NOT NULL DEFAULT FALSE,
  examples           JSONB NOT NULL DEFAULT '{}'::JSONB,
  version            INTEGER NOT NULL DEFAULT 1,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_directive_category_check') THEN
    ALTER TABLE client_editorial_directives ADD CONSTRAINT editorial_directive_category_check
      CHECK (category IN ('captacao', 'qualificacao', 'narrativa', 'terminologia', 'metrica', 'estrutura', 'visual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_directive_severity_check') THEN
    ALTER TABLE client_editorial_directives ADD CONSTRAINT editorial_directive_severity_check
      CHECK (severity IN ('block', 'warn', 'prefer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_directive_scope_check') THEN
    ALTER TABLE client_editorial_directives ADD CONSTRAINT editorial_directive_scope_check
      CHECK ((scope = 'permanent' AND period_month IS NULL) OR (scope = 'monthly' AND period_month IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_directive_source_check') THEN
    ALTER TABLE client_editorial_directives ADD CONSTRAINT editorial_directive_source_check
      CHECK (source IN ('cliente', 'operador', 'relatorio_aprovado', 'curado'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'editorial_directive_metric_visibility_check') THEN
    ALTER TABLE client_editorial_directives ADD CONSTRAINT editorial_directive_metric_visibility_check
      CHECK (metric_visibility IS NULL OR metric_visibility IN ('publica', 'interna', 'omitida'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS editorial_directive_permanent_unique_idx
  ON client_editorial_directives(client_id, directive_key)
  WHERE scope = 'permanent';
CREATE UNIQUE INDEX IF NOT EXISTS editorial_directive_monthly_unique_idx
  ON client_editorial_directives(client_id, directive_key, period_month)
  WHERE scope = 'monthly';
CREATE INDEX IF NOT EXISTS editorial_directive_active_idx
  ON client_editorial_directives(client_id, active, category, updated_at DESC);
ALTER TABLE client_editorial_directives ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_client_feedback (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  draft_id            UUID REFERENCES monthly_report_drafts(id) ON DELETE SET NULL,
  report_id           UUID REFERENCES reports(id) ON DELETE SET NULL,
  reference_report_id UUID REFERENCES reference_reports(id) ON DELETE SET NULL,
  directive_id        UUID REFERENCES client_editorial_directives(id) ON DELETE SET NULL,
  category            TEXT NOT NULL,
  feedback            TEXT NOT NULL,
  before_text         TEXT,
  after_text          TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  promoted            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_client_feedback_category_check') THEN
    ALTER TABLE report_client_feedback ADD CONSTRAINT report_client_feedback_category_check
      CHECK (category IN ('captacao', 'qualificacao', 'narrativa', 'terminologia', 'metrica', 'estrutura', 'visual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_client_feedback_status_check') THEN
    ALTER TABLE report_client_feedback ADD CONSTRAINT report_client_feedback_status_check
      CHECK (status IN ('pending', 'applied', 'dismissed'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_client_feedback_client_idx
  ON report_client_feedback(client_id, status, created_at DESC);
ALTER TABLE report_client_feedback ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_section_revisions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id    UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  section_key INTEGER NOT NULL,
  version     INTEGER NOT NULL,
  origin      TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, section_key, version, origin)
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_section_revisions_origin_check') THEN
    ALTER TABLE report_section_revisions ADD CONSTRAINT report_section_revisions_origin_check
      CHECK (origin IN ('ia', 'humano', 'importado'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_section_revisions_draft_idx
  ON report_section_revisions(draft_id, section_key, created_at DESC);
ALTER TABLE report_section_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS client_source_capture_intents (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_id         UUID REFERENCES sources(id) ON DELETE CASCADE,
  topic_template_id UUID REFERENCES client_report_topic_templates(id) ON DELETE SET NULL,
  intent            TEXT NOT NULL,
  cycle_stage       TEXT,
  label             TEXT NOT NULL,
  query_snapshot    JSONB NOT NULL DEFAULT '{}'::JSONB,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Mantém a migration retomável caso uma tentativa anterior tenha criado a
-- tabela antes da inclusão da etapa do ciclo regulatório.
ALTER TABLE client_source_capture_intents
  ADD COLUMN IF NOT EXISTS cycle_stage TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_source_capture_intent_check') THEN
    ALTER TABLE client_source_capture_intents ADD CONSTRAINT client_source_capture_intent_check
      CHECK (intent IN ('mencao_direta', 'eixo_permanente', 'agenda_mensal', 'institucional', 'busca_lacuna', 'ampla'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_source_capture_cycle_stage_check') THEN
    ALTER TABLE client_source_capture_intents ADD CONSTRAINT client_source_capture_cycle_stage_check
      CHECK (cycle_stage IS NULL OR cycle_stage IN (
        'publicacao', 'vacatio', 'vigencia', 'adequacao', 'reacao_setorial', 'disputa_judicial'
      ));
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS client_source_capture_intents_source_unique_idx
  ON client_source_capture_intents(client_id, source_id, intent, label)
  WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_source_capture_intents_virtual_unique_idx
  ON client_source_capture_intents(client_id, intent, label)
  WHERE source_id IS NULL;
CREATE INDEX IF NOT EXISTS client_source_capture_intents_client_idx
  ON client_source_capture_intents(client_id, active, intent);
ALTER TABLE client_source_capture_intents ENABLE ROW LEVEL SECURITY;

ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS applied_editorial_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS editorial_snapshot_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS applied_editorial_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB;

-- O tipo da referência determina como ela participa do aprendizado. Um PDF
-- entregue continua imutável e nunca vira matéria jornalística.
ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS reference_kind TEXT NOT NULL DEFAULT 'historical';
ALTER TABLE import_batches DROP CONSTRAINT IF EXISTS import_batches_reference_kind_check;
ALTER TABLE import_batches ADD CONSTRAINT import_batches_reference_kind_check
  CHECK (reference_kind IN ('historical', 'quality_reference', 'delivered_report', 'diagnostic_package'));

ALTER TABLE reference_reports
  ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES monthly_report_drafts(id) ON DELETE SET NULL;
ALTER TABLE reference_reports
  ADD COLUMN IF NOT EXISTS reference_kind TEXT NOT NULL DEFAULT 'historical';
ALTER TABLE reference_reports DROP CONSTRAINT IF EXISTS reference_reports_reference_kind_check;
ALTER TABLE reference_reports ADD CONSTRAINT reference_reports_reference_kind_check
  CHECK (reference_kind IN ('historical', 'quality_reference', 'delivered_report', 'diagnostic_package'));
CREATE INDEX IF NOT EXISTS reference_reports_draft_idx
  ON reference_reports(draft_id, reference_kind, created_at DESC)
  WHERE draft_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS report_package_exports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id            UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  base_version        INTEGER NOT NULL,
  export_kind         TEXT NOT NULL,
  checklist_snapshot  JSONB NOT NULL DEFAULT '{}'::JSONB,
  editorial_snapshot  JSONB NOT NULL DEFAULT '{}'::JSONB,
  manifest             JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_package_exports_kind_check') THEN
    ALTER TABLE report_package_exports ADD CONSTRAINT report_package_exports_kind_check
      CHECK (export_kind IN ('diagnostic', 'final'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_package_exports_draft_idx
  ON report_package_exports(draft_id, created_at DESC);
ALTER TABLE report_package_exports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reference_report_comparisons (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id             UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  reference_report_id  UUID NOT NULL REFERENCES reference_reports(id) ON DELETE CASCADE,
  diagnostic_reference_report_id UUID REFERENCES reference_reports(id) ON DELETE SET NULL,
  package_export_id    UUID REFERENCES report_package_exports(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'ready',
  summary              JSONB NOT NULL DEFAULT '{}'::JSONB,
  compared_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, reference_report_id)
);
ALTER TABLE reference_report_comparisons
  ADD COLUMN IF NOT EXISTS diagnostic_reference_report_id UUID REFERENCES reference_reports(id) ON DELETE SET NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reference_report_comparisons_status_check') THEN
    ALTER TABLE reference_report_comparisons ADD CONSTRAINT reference_report_comparisons_status_check
      CHECK (status IN ('pending', 'ready', 'review', 'error'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS reference_report_comparisons_draft_idx
  ON reference_report_comparisons(draft_id, compared_at DESC);
ALTER TABLE reference_report_comparisons ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_memory_suggestions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comparison_id  UUID NOT NULL REFERENCES reference_report_comparisons(id) ON DELETE CASCADE,
  client_id      UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  title          TEXT NOT NULL,
  suggestion     TEXT NOT NULL,
  evidence       JSONB NOT NULL DEFAULT '{}'::JSONB,
  status         TEXT NOT NULL DEFAULT 'pending',
  directive_id   UUID REFERENCES client_editorial_directives(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at    TIMESTAMPTZ
);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_memory_suggestions_category_check') THEN
    ALTER TABLE report_memory_suggestions ADD CONSTRAINT report_memory_suggestions_category_check
      CHECK (category IN ('captacao', 'qualificacao', 'narrativa', 'terminologia', 'metrica', 'estrutura', 'visual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_memory_suggestions_status_check') THEN
    ALTER TABLE report_memory_suggestions ADD CONSTRAINT report_memory_suggestions_status_check
      CHECK (status IN ('pending', 'accepted', 'dismissed'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS report_memory_suggestions_client_idx
  ON report_memory_suggestions(client_id, status, created_at DESC);
ALTER TABLE report_memory_suggestions ENABLE ROW LEVEL SECURITY;

ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS diagnostic_package_generated_at TIMESTAMPTZ;
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS final_package_base_version INTEGER;
ALTER TABLE monthly_report_drafts
  ADD COLUMN IF NOT EXISTS final_package_generated_at TIMESTAMPTZ;

ALTER TABLE article_period_assignments
  ADD COLUMN IF NOT EXISTS editorial_reason TEXT NOT NULL DEFAULT 'Associação editorial manual';
ALTER TABLE article_period_assignments
  ADD COLUMN IF NOT EXISTS cycle_stage TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'article_period_assignment_cycle_stage_check') THEN
    ALTER TABLE article_period_assignments ADD CONSTRAINT article_period_assignment_cycle_stage_check
      CHECK (cycle_stage IS NULL OR cycle_stage IN (
        'publicacao', 'vacatio', 'vigencia', 'adequacao', 'reacao_setorial', 'disputa_judicial'
      ));
  END IF;
END $$;

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_type_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_type_check
  CHECK (document_type IN (
    'caderno', 'artigo', 'relatorio', 'mensagem', 'lista_urls', 'pacote', 'desconhecido'
  ));

-- Feedback permanente já fornecido para os relatórios de julho de 2026.
INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, metric_visibility, examples
)
SELECT id, 'simineral-enquadramento-visao-geral', 'narrativa',
  'Visão geral com inserções sobre o SIMINERAL',
  'Enquadrar o produto como visão geral de inteligência setorial, com inserções sobre o SIMINERAL e o ecossistema mineral paraense.',
  'Evita que baixa exposição nominal seja apresentada como insuficiência do trabalho.',
  'block', 'permanent', 'cliente', NULL,
  '{"preferir":["visão geral de inteligência setorial, com inserções sobre o SIMINERAL"],"evitar":["só duas menções","apenas duas menções","somente dois itens do SIMINERAL"]}'::JSONB
FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, rationale = EXCLUDED.rationale, severity = EXCLUDED.severity,
  examples = EXCLUDED.examples, version = client_editorial_directives.version + 1, active = TRUE, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.rationale, client_editorial_directives.severity, client_editorial_directives.examples, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.rationale, EXCLUDED.severity, EXCLUDED.examples, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, metric_visibility, examples
)
SELECT id, 'simineral-mencoes-diretas-internas', 'metrica',
  'Menções diretas somente nas saídas internas',
  'Preservar a contagem exata no CORTEX, checklist e CSV interno, sem expor número baixo de menções diretas no relatório ou no pacote público.',
  'Feedback de sensibilidade do cliente.', 'block', 'permanent', 'cliente', 'interna', '{}'::JSONB
FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, metric_visibility = EXCLUDED.metric_visibility,
  version = client_editorial_directives.version + 1, active = TRUE, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.metric_visibility, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.metric_visibility, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, examples
)
SELECT id, 'simineral-direcao-visual-amazonia', 'visual',
  'Floresta, rios e território paraense',
  'Priorizar floresta amazônica, rios, paisagem paraense e imagens que articulem mineração, território e sustentabilidade. Evitar mineração estrangeira genérica sem vínculo com a pauta.',
  'Direção visual solicitada pelo cliente.', 'prefer', 'permanent', 'cliente',
  '{"consultas":["floresta amazônica Pará vista aérea","rios e floresta Amazônia Pará","mineração sustentabilidade território paraense"]}'::JSONB
FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, examples = EXCLUDED.examples,
  version = client_editorial_directives.version + 1, active = TRUE, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.examples, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.examples, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, phrase, replacements, allow_literal_quote, examples
)
SELECT id, 'ons-bloquear-calmaria-operacional', 'terminologia',
  'Evitar “calmaria operacional”',
  'Não usar “calmaria operacional” como título, diagnóstico ou interpretação. A expressão somente pode aparecer como citação literal identificada e sustentada por evidência.',
  'O termo pode sugerir ausência de risco e gerar desconforto reputacional.', 'block', 'permanent', 'cliente',
  'calmaria operacional',
  '["operação sob controle","condições hidrológicas favoráveis","alívio conjuntural"]'::JSONB,
  TRUE,
  '{"observacao":"As alternativas devem preservar condicionantes e não sugerir ausência de risco."}'::JSONB
FROM clients WHERE name = 'ONS'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, phrase = EXCLUDED.phrase, replacements = EXCLUDED.replacements,
  allow_literal_quote = EXCLUDED.allow_literal_quote, version = client_editorial_directives.version + 1,
  active = TRUE, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.phrase, client_editorial_directives.replacements, client_editorial_directives.allow_literal_quote, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.phrase, EXCLUDED.replacements, EXCLUDED.allow_literal_quote, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, examples
)
SELECT id, 'sindinfor-regulacao-plataformas', 'qualificacao',
  'Regulação digital e responsabilidade de plataformas',
  'Priorizar mudanças regulatórias com impacto demonstrável sobre provedores, desenvolvedores, empresas de software, custos de conformidade, moderação, proteção de dados ou segurança jurídica. Menções genéricas a redes sociais não bastam.',
  'Eixo permanente solicitado após o relatório de julho de 2026.',
  'block', 'permanent', 'cliente',
  '{"incluir":["deveres de provedores","adequação operacional","custos de conformidade","responsabilidade de plataformas","disputa judicial"],"excluir":["uso cotidiano de rede social","tecnologia de consumo sem impacto setorial"]}'::JSONB
FROM clients WHERE name = 'SINDINFOR'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, rationale = EXCLUDED.rationale, examples = EXCLUDED.examples,
  version = client_editorial_directives.version + 1, active = TRUE, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.rationale, client_editorial_directives.examples, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.rationale, EXCLUDED.examples, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, source, metric_visibility
)
SELECT id, 'sindinfor-mencoes-diretas-internas', 'metrica',
  'Menções diretas somente nas saídas internas',
  'Preservar a contagem de menções diretas no CORTEX, checklist e CSV interno; no material público, apresentar inteligência setorial e inserções do SINDINFOR sem destacar contagem nominal baixa.',
  'Evita transformar ausência de exposição nominal em diagnóstico depreciativo.',
  'block', 'permanent', 'operador', 'interna'
FROM clients WHERE name = 'SINDINFOR'
ON CONFLICT (client_id, directive_key) WHERE scope = 'permanent' DO UPDATE SET
  instruction = EXCLUDED.instruction, rationale = EXCLUDED.rationale,
  metric_visibility = EXCLUDED.metric_visibility, active = TRUE,
  version = client_editorial_directives.version + 1, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.rationale, client_editorial_directives.metric_visibility, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.rationale, EXCLUDED.metric_visibility, TRUE);

INSERT INTO client_editorial_directives (
  client_id, directive_key, category, title, instruction, rationale, severity,
  scope, period_month, source, examples
)
SELECT id, 'sindinfor-2026-07-decretos-plataformas', 'qualificacao',
  'Decretos 12.975 e 12.976 no ciclo regulatório de julho',
  'Tratar separadamente o Decreto 12.975, que altera a regulamentação do Marco Civil, e o Decreto 12.976, voltado à proteção de mulheres na internet. Distinguir obrigação normativa, impacto setorial, reação identificada e disputa judicial. Não afirmar resistência ampla do setor sem entidade, representante, data e fonte.',
  'Correção solicitada para a versão de julho de 2026.',
  'block', 'monthly', DATE '2026-07-01', 'cliente',
  '{"association_reason":"Publicados em maio e associados editorialmente a julho pela vigência e repercussão regulatória.","subtopics":["obrigações e adequação","reação setorial comprovada","STF e Congresso"]}'::JSONB
FROM clients WHERE name = 'SINDINFOR'
ON CONFLICT (client_id, directive_key, period_month) WHERE scope = 'monthly' DO UPDATE SET
  instruction = EXCLUDED.instruction, rationale = EXCLUDED.rationale, examples = EXCLUDED.examples,
  active = TRUE, version = client_editorial_directives.version + 1, updated_at = NOW()
WHERE (client_editorial_directives.instruction, client_editorial_directives.rationale, client_editorial_directives.examples, client_editorial_directives.active)
  IS DISTINCT FROM (EXCLUDED.instruction, EXCLUDED.rationale, EXCLUDED.examples, TRUE);

UPDATE client_editorial_profiles
SET permanent_axes = CASE
      WHEN permanent_axes @> '["regulação digital e responsabilidade de plataformas"]'::JSONB THEN permanent_axes
      ELSE permanent_axes || '["regulação digital e responsabilidade de plataformas"]'::JSONB
    END,
    version = version + 1,
    updated_at = NOW()
WHERE client_id IN (SELECT id FROM clients WHERE name = 'SINDINFOR')
  AND NOT (permanent_axes @> '["regulação digital e responsabilidade de plataformas"]'::JSONB);

INSERT INTO client_editorial_profile_versions (client_id, version, snapshot)
SELECT profile.client_id, profile.version,
  jsonb_build_object(
    'permanent_axes', profile.permanent_axes,
    'inclusion_guidelines', profile.inclusion_guidelines,
    'exclusion_guidelines', profile.exclusion_guidelines,
    'style_guidelines', profile.style_guidelines,
    'default_posture', profile.default_posture,
    'active', profile.active
  )
FROM client_editorial_profiles profile
JOIN clients client ON client.id = profile.client_id
WHERE client.name = 'SINDINFOR'
ON CONFLICT (client_id, version) DO NOTHING;

INSERT INTO client_report_topic_templates (
  client_id, position, title, rationale, inclusion_terms, exclusion_terms, required, active
)
SELECT client.id,
  COALESCE((SELECT MAX(template.position) + 1 FROM client_report_topic_templates template WHERE template.client_id = client.id), 1),
  'Regulação de plataformas e impacto para empresas de software',
  'Acompanhar publicação, vacatio, vigência, adequação, reação setorial e disputa judicial de normas digitais.',
  '["regulação de plataformas","Marco Civil da Internet","responsabilidade de provedores","moderação de conteúdo","dever de cuidado"]'::JSONB,
  '["uso de rede social","influenciador","aplicativo de consumo"]'::JSONB,
  TRUE, TRUE
FROM clients client WHERE client.name = 'SINDINFOR'
ON CONFLICT (client_id, title) DO UPDATE SET
  rationale = EXCLUDED.rationale, inclusion_terms = EXCLUDED.inclusion_terms,
  exclusion_terms = EXCLUDED.exclusion_terms, required = TRUE, active = TRUE, updated_at = NOW();

INSERT INTO monthly_report_topics (
  draft_id, position, title, rationale, inclusion_terms, exclusion_terms, required, coverage_status
)
SELECT draft.id, COALESCE((SELECT MAX(position) + 1 FROM monthly_report_topics WHERE draft_id = draft.id), 4),
  'Implementação dos Decretos 12.975 e 12.976',
  'Cobrir separadamente obrigações e adequação, reação setorial comprovada e questionamentos judiciais ou legislativos.',
  '["Decreto 12.975","Decreto 12.976","Marco Civil da Internet","provedores de aplicações","STF","sustação"]'::JSONB,
  '["redes sociais sem impacto empresarial"]'::JSONB,
  TRUE, 'unchecked'
FROM monthly_report_drafts draft
JOIN clients client ON client.id = draft.client_id
WHERE client.name = 'SINDINFOR'
  AND draft.period_month = DATE '2026-07-01'
  AND draft.status <> 'approved'
  AND NOT EXISTS (
    SELECT 1 FROM monthly_report_topics topic
    WHERE topic.draft_id = draft.id AND topic.title = 'Implementação dos Decretos 12.975 e 12.976'
  );

-- Consultas de menção direta são separadas das consultas setoriais para que o
-- sistema possa medir recall nominal sem confundi-lo com cobertura temática.
INSERT INTO sources (name, url, type, active, is_general, priority, access_mode, categoria) VALUES
  ('Google News — ONS/Menção direta', 'https://news.google.com/rss/search?q=%22Operador%20Nacional%20do%20Sistema%20El%C3%A9trico%22%20OR%20%22ONS%20energia%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — CCEE/Menção direta', 'https://news.google.com/rss/search?q=%22C%C3%A2mara%20de%20Comercializa%C3%A7%C3%A3o%20de%20Energia%20El%C3%A9trica%22%20OR%20%22CCEE%20energia%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — DAQ/Menção direta', 'https://news.google.com/rss/search?q=%22Diretoria%20de%20Infraestrutura%20Aquavi%C3%A1ria%22%20OR%20%22DAQ%20DNIT%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — SIMINERAL/Menção direta', 'https://news.google.com/rss/search?q=SIMINERAL%20OR%20%22Sindicato%20das%20Ind%C3%BAstrias%20Minerais%20do%20Estado%20do%20Par%C3%A1%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — SINDINFOR/Menção direta', 'https://news.google.com/rss/search?q=SINDINFOR%20OR%20%22Sindicato%20da%20Ind%C3%BAstria%20de%20Software%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority,
  access_mode = EXCLUDED.access_mode, categoria = EXCLUDED.categoria;

-- Cobertura regulatória do SINDINFOR por evento. As fontes primárias sustentam
-- os fatos; as consultas de imprensa procuram impacto e reação comprovável.
INSERT INTO sources (name, url, type, active, is_general, priority, access_mode, categoria) VALUES
  ('Planalto — Decreto 12.975/2026', 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12975.htm', 'scrape', TRUE, FALSE, 100, 'publico', 'institucional'),
  ('Planalto — Decreto 12.976/2026', 'https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12976.htm', 'scrape', TRUE, FALSE, 100, 'publico', 'institucional'),
  ('Google News — SINDINFOR/Decretos 12.975 e 12.976', 'https://news.google.com/rss/search?q=%22Decreto%2012.975%22%20OR%20%22Decreto%2012.976%22%20OR%20%22regulamenta%C3%A7%C3%A3o%20do%20Marco%20Civil%22&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — SINDINFOR/Vacatio dos Decretos 12.975 e 12.976', 'https://news.google.com/rss/search?q=%28%22Decreto%2012.975%22%20OR%20%22Decreto%2012.976%22%29%20%28%2260%20dias%22%20OR%20vacatio%20OR%20%22entrada%20em%20vigor%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 95, 'publico', 'imprensa'),
  ('Google News — SINDINFOR/Adequação aos Decretos 12.975 e 12.976', 'https://news.google.com/rss/search?q=%28%22Decreto%2012.975%22%20OR%20%22Decreto%2012.976%22%29%20%28adequa%C3%A7%C3%A3o%20OR%20conformidade%20OR%20implementa%C3%A7%C3%A3o%20OR%20%22custos%20operacionais%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa'),
  ('Google News — SINDINFOR/Reação setorial a plataformas', 'https://news.google.com/rss/search?q=%28%22Decreto%2012.975%22%20OR%20%22responsabilidade%20de%20plataformas%22%29%20%28associa%C3%A7%C3%A3o%20OR%20startups%20OR%20%22empresas%20de%20tecnologia%22%20OR%20software%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 95, 'publico', 'imprensa'),
  ('Google News — SINDINFOR/STF e Congresso sobre plataformas', 'https://news.google.com/rss/search?q=%28%22Decreto%2012.975%22%20OR%20%22Decreto%2012.976%22%29%20%28STF%20OR%20ADI%20OR%20Congresso%20OR%20PDL%20OR%20susta%C3%A7%C3%A3o%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419', 'rss', TRUE, FALSE, 100, 'publico', 'imprensa')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name, active = TRUE, priority = EXCLUDED.priority,
  access_mode = EXCLUDED.access_mode, categoria = EXCLUDED.categoria;

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, 100, TRUE
FROM clients client
JOIN sources source ON source.name = 'Google News — ' ||
  CASE client.name
    WHEN 'ONS' THEN 'ONS'
    WHEN 'CCEE' THEN 'CCEE'
    WHEN 'SIMINERAL' THEN 'SIMINERAL'
    WHEN 'SINDINFOR' THEN 'SINDINFOR'
    ELSE 'DAQ'
  END || '/Menção direta'
WHERE client.active = TRUE
  AND client.name IN ('ONS', 'CCEE', 'SIMINERAL', 'SINDINFOR', 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT')
ON CONFLICT (client_id, source_id) DO UPDATE SET priority = 100, is_thematic = TRUE;

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT client.id, source.id, source.priority, TRUE
FROM clients client
JOIN sources source ON source.name IN (
  'Planalto — Decreto 12.975/2026',
  'Planalto — Decreto 12.976/2026',
  'Google News — SINDINFOR/Decretos 12.975 e 12.976',
  'Google News — SINDINFOR/Vacatio dos Decretos 12.975 e 12.976',
  'Google News — SINDINFOR/Adequação aos Decretos 12.975 e 12.976',
  'Google News — SINDINFOR/Reação setorial a plataformas',
  'Google News — SINDINFOR/STF e Congresso sobre plataformas'
)
WHERE client.name = 'SINDINFOR'
ON CONFLICT (client_id, source_id) DO UPDATE SET
  priority = EXCLUDED.priority, is_thematic = TRUE;

INSERT INTO client_source_capture_intents (
  client_id, source_id, intent, cycle_stage, label, query_snapshot
)
SELECT client.id, source.id, seed.intent, seed.cycle_stage, source.name,
  jsonb_build_object('source_name', source.name, 'source_url', source.url, 'verified_seed', TRUE)
FROM clients client
JOIN (
  VALUES
    ('Planalto — Decreto 12.975/2026', 'agenda_mensal', 'publicacao'),
    ('Planalto — Decreto 12.976/2026', 'agenda_mensal', 'publicacao'),
    ('Google News — SINDINFOR/Decretos 12.975 e 12.976', 'agenda_mensal', 'vigencia'),
    ('Google News — SINDINFOR/Vacatio dos Decretos 12.975 e 12.976', 'agenda_mensal', 'vacatio'),
    ('Google News — SINDINFOR/Adequação aos Decretos 12.975 e 12.976', 'agenda_mensal', 'adequacao'),
    ('Google News — SINDINFOR/Reação setorial a plataformas', 'agenda_mensal', 'reacao_setorial'),
    ('Google News — SINDINFOR/STF e Congresso sobre plataformas', 'agenda_mensal', 'disputa_judicial')
) AS seed(source_name, intent, cycle_stage) ON TRUE
JOIN sources source ON source.name = seed.source_name
WHERE client.name = 'SINDINFOR'
ON CONFLICT (client_id, source_id, intent, label) WHERE source_id IS NOT NULL
DO UPDATE SET cycle_stage = EXCLUDED.cycle_stage, query_snapshot = EXCLUDED.query_snapshot,
  active = TRUE, updated_at = NOW();

-- Classifica os vínculos de fontes existentes sem modificar a coleta atual.
INSERT INTO client_source_capture_intents (client_id, source_id, intent, label, query_snapshot)
SELECT cs.client_id, cs.source_id,
  CASE
    WHEN s.name LIKE 'Google News — %/Menção direta' THEN 'mencao_direta'
    WHEN s.categoria = 'institucional' THEN 'institucional'
    WHEN cs.is_thematic THEN 'eixo_permanente'
    ELSE 'ampla'
  END,
  s.name,
  jsonb_build_object('source_name', s.name, 'source_url', s.url, 'priority', cs.priority)
FROM client_sources cs
JOIN sources s ON s.id = cs.source_id
ON CONFLICT (client_id, source_id, intent, label) WHERE source_id IS NOT NULL
DO UPDATE SET query_snapshot = EXCLUDED.query_snapshot, active = TRUE, updated_at = NOW();

COMMENT ON TABLE client_editorial_directives IS
  'Regras humanas e versionadas aplicadas apenas na camada editorial correspondente.';
COMMENT ON TABLE report_client_feedback IS
  'Feedback auditável; somente itens promovidos explicitamente viram memória permanente.';
