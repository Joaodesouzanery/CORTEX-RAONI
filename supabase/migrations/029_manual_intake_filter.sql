-- 029: diferencia notícias recebidas manualmente sem alterar sua qualificação.
-- Idempotente. Depende de 001..028.

ALTER TABLE article_client_tags
  ADD COLUMN IF NOT EXISTS manual_intake BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE article_client_tags
  ADD COLUMN IF NOT EXISTS manual_received_at TIMESTAMPTZ;

-- O índice derivado torna o filtro paginado barato. A proveniência e os lotes
-- continuam sendo a fonte oficial para auditoria e para o backfill abaixo.
CREATE INDEX IF NOT EXISTS act_manual_intake_idx
  ON article_client_tags(client_id, manual_received_at DESC, article_id)
  WHERE manual_intake = TRUE;

-- Somente lotes com finalidade "noticias" contam como materiais recebidos.
-- Relatórios de referência e seleções feitas dentro da preparação mensal não
-- pertencem a import_batch_documents de um lote de notícias e ficam de fora.
WITH manual_history AS (
  SELECT
    provenance.article_id,
    batch_client.client_id,
    MIN(batch_document.created_at) AS first_received_at
  FROM article_provenance AS provenance
  INNER JOIN import_batch_documents AS batch_document
    ON batch_document.document_id = provenance.source_document_id
  INNER JOIN import_batches AS batch
    ON batch.id = batch_document.batch_id
   AND batch.intent = 'noticias'
  INNER JOIN import_batch_clients AS batch_client
    ON batch_client.batch_id = batch.id
  GROUP BY provenance.article_id, batch_client.client_id
)
INSERT INTO article_client_tags (
  article_id,
  client_id,
  manual_intake,
  manual_received_at
)
SELECT
  article_id,
  client_id,
  TRUE,
  first_received_at
FROM manual_history
ON CONFLICT (article_id, client_id) DO UPDATE
SET
  manual_intake = TRUE,
  manual_received_at = CASE
    WHEN article_client_tags.manual_received_at IS NULL
      THEN EXCLUDED.manual_received_at
    ELSE LEAST(article_client_tags.manual_received_at, EXCLUDED.manual_received_at)
  END;
