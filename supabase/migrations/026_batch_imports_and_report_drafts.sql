-- 026: importações em lote, referências e preparação mensal auditável.
-- Idempotente. Depende de 001..025.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Marca editorial configurável. O snapshot imutável é guardado no rascunho e
-- no relatório final; mudanças futuras no cliente não alteram o histórico.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_brand_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_brand_footer TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_brand_guidelines TEXT;

UPDATE clients
SET
  report_brand_name = COALESCE(
    report_brand_name,
    CASE
      WHEN name = 'ONS' THEN 'CRTIVE LAB'
      ELSE NULLIF(BTRIM(contratante), '')
    END
  ),
  report_brand_footer = COALESCE(
    report_brand_footer,
    CASE
      WHEN name = 'ONS' THEN 'Suporte Estratégico Prestado por: CRTIVE LAB'
      WHEN NULLIF(BTRIM(contratante), '') IS NOT NULL
        THEN 'Suporte Estratégico Prestado por: ' || BTRIM(contratante)
      ELSE NULL
    END
  )
WHERE report_brand_name IS NULL OR report_brand_footer IS NULL;

CREATE TABLE IF NOT EXISTS import_batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  period_month    DATE NOT NULL,
  intent          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  total_files     INTEGER NOT NULL DEFAULT 0,
  completed_files INTEGER NOT NULL DEFAULT 0,
  review_files    INTEGER NOT NULL DEFAULT 0,
  failed_files    INTEGER NOT NULL DEFAULT 0,
  article_count   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_intent_check') THEN
    ALTER TABLE import_batches ADD CONSTRAINT import_batches_intent_check
      CHECK (intent IN ('noticias', 'relatorio_referencia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batches_status_check') THEN
    ALTER TABLE import_batches ADD CONSTRAINT import_batches_status_check
      CHECK (status IN ('pending', 'processing', 'complete', 'partial', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS import_batches_client_period_idx
  ON import_batches(client_id, period_month DESC, created_at DESC);
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- OCR é opcional e preserva tanto o original quanto o texto extraído.
ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS ocr_status TEXT NOT NULL DEFAULT 'not_requested';
ALTER TABLE source_documents ADD COLUMN IF NOT EXISTS ocr_text TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_documents_ocr_status_check') THEN
    ALTER TABLE source_documents ADD CONSTRAINT source_documents_ocr_status_check
      CHECK (ocr_status IN ('not_requested', 'pending', 'processing', 'complete', 'error'));
  END IF;
END $$;

-- A relação lote-documento permite reutilizar com segurança um PDF idêntico
-- em outra competência/cliente sem duplicar o arquivo no Storage.
CREATE TABLE IF NOT EXISTS import_batch_documents (
  batch_id     UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
  filename     TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending',
  article_count INTEGER NOT NULL DEFAULT 0,
  error        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (batch_id, document_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batch_documents_status_check') THEN
    ALTER TABLE import_batch_documents ADD CONSTRAINT import_batch_documents_status_check
      CHECK (status IN ('pending', 'uploading', 'processing', 'complete', 'review', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS import_batch_documents_batch_idx
  ON import_batch_documents(batch_id, status, created_at);
ALTER TABLE import_batch_documents ENABLE ROW LEVEL SECURITY;

-- Competência editorial de uma matéria importada. published_at continua sendo
-- a data jornalística verdadeira (e pode permanecer nula).
CREATE TABLE IF NOT EXISTS article_period_assignments (
  article_id         UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_month       DATE NOT NULL,
  source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, client_id, period_month, source_document_id)
);

CREATE INDEX IF NOT EXISTS article_period_assignments_period_idx
  ON article_period_assignments(client_id, period_month, article_id);
ALTER TABLE article_period_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reference_reports (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  period_month       DATE NOT NULL,
  source_document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE RESTRICT,
  title              TEXT NOT NULL,
  extracted_text     TEXT,
  status             TEXT NOT NULL DEFAULT 'ready',
  metadata           JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, period_month, source_document_id)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reference_reports_status_check') THEN
    ALTER TABLE reference_reports ADD CONSTRAINT reference_reports_status_check
      CHECK (status IN ('ready', 'ocr_pending', 'review', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reference_reports_period_idx
  ON reference_reports(client_id, period_month DESC);
ALTER TABLE reference_reports ENABLE ROW LEVEL SECURITY;

-- Papel editorial independente da classificação de monitoramento.
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS report_role TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS editorial_score INTEGER;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS editorial_reason TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS cluster_label TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS report_role_source TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS triaged_at TIMESTAMPTZ;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS triage_version INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_report_role_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_report_role_check
      CHECK (report_role IS NULL OR report_role IN ('evidencia', 'contexto', 'ruido'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_editorial_score_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_editorial_score_check
      CHECK (editorial_score IS NULL OR (editorial_score >= 0 AND editorial_score <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_report_role_source_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_report_role_source_check
      CHECK (report_role_source IS NULL OR report_role_source IN ('regra', 'ia', 'humano'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS act_report_triage_idx
  ON article_client_tags(client_id, report_role, editorial_score DESC, article_id);

CREATE TABLE IF NOT EXISTS monthly_report_drafts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id          UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  period_month       DATE NOT NULL,
  version            INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'preparing',
  lead_article_id    UUID REFERENCES articles(id) ON DELETE SET NULL,
  monthly_instructions TEXT NOT NULL DEFAULT '',
  service_metrics    JSONB NOT NULL DEFAULT '{}'::JSONB,
  brand_snapshot     JSONB NOT NULL DEFAULT '{}'::JSONB,
  base_version       INTEGER NOT NULL DEFAULT 1,
  base_refreshed_at  TIMESTAMPTZ,
  error              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ,
  UNIQUE (client_id, period_month, version)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_report_drafts_status_check') THEN
    ALTER TABLE monthly_report_drafts ADD CONSTRAINT monthly_report_drafts_status_check
      CHECK (status IN ('preparing', 'triaging', 'ready', 'generating', 'review', 'approved', 'stale', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_report_drafts_period_idx
  ON monthly_report_drafts(client_id, period_month DESC, version DESC);
ALTER TABLE monthly_report_drafts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS report_evidence_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id                UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  article_id              UUID NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
  bucket                  TEXT NOT NULL,
  position                INTEGER NOT NULL,
  article_snapshot        JSONB NOT NULL,
  classification_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  cluster_key             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, article_id),
  UNIQUE (draft_id, bucket, position)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_evidence_items_bucket_check') THEN
    ALTER TABLE report_evidence_items ADD CONSTRAINT report_evidence_items_bucket_check
      CHECK (bucket IN ('qualified', 'annex', 'excluded'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_evidence_items_draft_idx
  ON report_evidence_items(draft_id, bucket, position);
ALTER TABLE report_evidence_items ENABLE ROW LEVEL SECURITY;

-- Troca atômica da base: uma falha de rede nunca deixa metade dos 600+ itens
-- visível nem duplica uma ocorrência entre base e anexo.
CREATE OR REPLACE FUNCTION replace_report_evidence(p_draft_id UUID, p_items JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM monthly_report_drafts WHERE id = p_draft_id) THEN
    RAISE EXCEPTION 'Rascunho não encontrado';
  END IF;

  DELETE FROM report_evidence_items WHERE draft_id = p_draft_id;

  INSERT INTO report_evidence_items (
    draft_id,
    article_id,
    bucket,
    position,
    article_snapshot,
    classification_snapshot,
    cluster_key
  )
  SELECT
    p_draft_id,
    item.article_id,
    item.bucket,
    item.position,
    item.article_snapshot,
    COALESCE(item.classification_snapshot, '{}'::JSONB),
    item.cluster_key
  FROM jsonb_to_recordset(COALESCE(p_items, '[]'::JSONB)) AS item(
    article_id UUID,
    bucket TEXT,
    position INTEGER,
    article_snapshot JSONB,
    classification_snapshot JSONB,
    cluster_key TEXT
  );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
REVOKE ALL ON FUNCTION replace_report_evidence(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_report_evidence(UUID, JSONB)
  TO service_role;

CREATE TABLE IF NOT EXISTS report_sections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_id    UUID NOT NULL REFERENCES monthly_report_drafts(id) ON DELETE CASCADE,
  section_key INTEGER NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  version     INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_id, section_key)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_sections_key_check') THEN
    ALTER TABLE report_sections ADD CONSTRAINT report_sections_key_check
      CHECK (section_key >= 1 AND section_key <= 9);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'report_sections_status_check') THEN
    ALTER TABLE report_sections ADD CONSTRAINT report_sections_status_check
      CHECK (status IN ('pending', 'generating', 'generated', 'edited', 'stale', 'error'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS report_sections_draft_idx
  ON report_sections(draft_id, section_key);
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES monthly_report_drafts(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS period_month DATE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS version INTEGER;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS lead_article_id UUID REFERENCES articles(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS brand_snapshot JSONB;
CREATE INDEX IF NOT EXISTS reports_draft_idx ON reports(draft_id, version DESC);

-- A migration 023 restringia os tipos conhecidos. "relatorio" é deliberado:
-- um relatório de referência nunca entra no acervo como matéria.
ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_type_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_type_check
  CHECK (document_type IN ('caderno', 'artigo', 'relatorio', 'desconhecido'));
