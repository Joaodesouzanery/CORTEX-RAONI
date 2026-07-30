-- 027: caixa de entrada multicliente e qualificação estratégica completa.
-- Idempotente. Preserva os contratos e dados criados pelas migrations 023..026.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Um lote pode ser destinado manualmente a vários clientes. client_id em
-- import_batches continua como cliente legado/primário para compatibilidade.
CREATE TABLE IF NOT EXISTS import_batch_clients (
  batch_id   UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  client_id  UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, client_id)
);

INSERT INTO import_batch_clients (batch_id, client_id)
SELECT id, client_id
FROM import_batches
ON CONFLICT (batch_id, client_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS import_batch_clients_client_idx
  ON import_batch_clients(client_id, batch_id);
ALTER TABLE import_batch_clients ENABLE ROW LEVEL SECURITY;

-- O mesmo pipeline recebe arquivos, URLs e mensagens coladas. O original de
-- entradas textuais é preservado em source_documents/Storage.
ALTER TABLE import_batch_documents ADD COLUMN IF NOT EXISTS input_kind TEXT NOT NULL DEFAULT 'file';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'import_batch_documents_input_kind_check') THEN
    ALTER TABLE import_batch_documents ADD CONSTRAINT import_batch_documents_input_kind_check
      CHECK (input_kind IN ('file', 'url', 'text'));
  END IF;
END $$;

ALTER TABLE source_documents DROP CONSTRAINT IF EXISTS source_documents_type_check;
ALTER TABLE source_documents ADD CONSTRAINT source_documents_type_check
  CHECK (document_type IN (
    'caderno', 'artigo', 'relatorio', 'mensagem', 'lista_urls', 'desconhecido'
  ));

-- Ficha estratégica. Os campos reputacionais existentes continuam válidos;
-- estes registram o raciocínio editorial usado no relatório final.
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS central_message TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS strategic_effect TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS recommended_action TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS editorial_review_state TEXT NOT NULL DEFAULT 'automatico';
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS qualification_version INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_strategic_effect_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_strategic_effect_check
      CHECK (strategic_effect IS NULL OR strategic_effect IN ('oportunidade', 'risco', 'misto', 'informativo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_verification_status_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_verification_status_check
      CHECK (verification_status IN ('verificada', 'parcial', 'pendente'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_editorial_review_state_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_editorial_review_state_check
      CHECK (editorial_review_state IN ('automatico', 'pendente', 'revisado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS act_review_queue_idx
  ON article_client_tags(client_id, editorial_review_state, editorial_score DESC, article_id);

-- Linhas extraídas de relatórios anteriores formam uma base-ouro auditável.
-- O snapshot original nunca é reescrito por reclassificações futuras.
CREATE TABLE IF NOT EXISTS reference_report_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_report_id     UUID NOT NULL REFERENCES reference_reports(id) ON DELETE CASCADE,
  row_number              INTEGER NOT NULL,
  article_id              UUID REFERENCES articles(id) ON DELETE SET NULL,
  match_status            TEXT NOT NULL DEFAULT 'pending',
  original_snapshot       JSONB NOT NULL,
  classification_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  match_confidence        NUMERIC(4,3),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reconciled_at           TIMESTAMPTZ,
  UNIQUE (reference_report_id, row_number)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reference_report_items_match_check') THEN
    ALTER TABLE reference_report_items ADD CONSTRAINT reference_report_items_match_check
      CHECK (match_status IN ('pending', 'linked', 'created', 'ambiguous'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reference_report_items_confidence_check') THEN
    ALTER TABLE reference_report_items ADD CONSTRAINT reference_report_items_confidence_check
      CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reference_report_items_report_idx
  ON reference_report_items(reference_report_id, row_number);
CREATE INDEX IF NOT EXISTS reference_report_items_article_idx
  ON reference_report_items(article_id)
  WHERE article_id IS NOT NULL;
ALTER TABLE reference_report_items ENABLE ROW LEVEL SECURITY;

-- Registros antigos recebem estado conservador, sem serem excluídos.
UPDATE article_client_tags
SET
  verification_status = CASE
    WHEN content_status.status = 'integral' THEN 'verificada'
    WHEN content_status.status = 'parcial' THEN 'parcial'
    ELSE 'pendente'
  END,
  editorial_review_state = CASE
    WHEN classification_source = 'humano' OR report_role_source = 'humano' THEN 'revisado'
    WHEN monitoring_status = 'revisao' THEN 'pendente'
    ELSE 'automatico'
  END
FROM (
  SELECT id, COALESCE(content_status, 'metadados') AS status
  FROM articles
) AS content_status
WHERE article_client_tags.article_id = content_status.id
  AND article_client_tags.qualified_at IS NULL;
