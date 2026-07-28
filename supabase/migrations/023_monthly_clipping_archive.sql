-- 023: acervo permanente, importação licenciada e edições mensais versionadas.
-- Idempotente. Depende de 001..022.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clientes ativos: o fechamento mensal considera apenas estes registros.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

-- Normaliza os três cadastros que já representavam os clientes finais, mantendo
-- seus UUIDs e, portanto, tags e relatórios históricos.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM clients WHERE name = 'SindInfor')
     AND NOT EXISTS (SELECT 1 FROM clients WHERE name = 'SINDINFOR') THEN
    UPDATE clients SET name = 'SINDINFOR' WHERE name = 'SindInfor';
  END IF;
  IF EXISTS (SELECT 1 FROM clients WHERE name = 'DNIT Aquaviária')
     AND NOT EXISTS (SELECT 1 FROM clients WHERE name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT') THEN
    UPDATE clients
      SET name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT'
      WHERE name = 'DNIT Aquaviária';
  END IF;
  IF EXISTS (SELECT 1 FROM clients WHERE name = 'Mineração')
     AND NOT EXISTS (SELECT 1 FROM clients WHERE name = 'SIMINERAL') THEN
    UPDATE clients SET name = 'SIMINERAL' WHERE name = 'Mineração';
  END IF;
END $$;

UPDATE clients SET active = name IN (
  'ONS',
  'CCEE',
  'SINDINFOR',
  'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT',
  'SIMINERAL'
);

UPDATE clients
SET
  sector = 'Mineração e indústria mineral no Estado do Pará',
  context = 'Sindicato das Indústrias Minerais do Estado do Pará — representação institucional da indústria mineral paraense, com atenção a licenciamento, sustentabilidade, infraestrutura, tributação, comunidades e desenvolvimento regional.',
  keywords = ARRAY['SIMINERAL', 'mineração no Pará', 'indústria mineral paraense', 'setor mineral do Pará'],
  synonyms = 'Sindicato das Indústrias Minerais do Estado do Pará, mineração, indústria mineral, ANM, Agência Nacional de Mineração, lavra, CFEM, minério de ferro, bauxita, cobre, níquel, ouro, manganês, caulim, licenciamento mineral, barragem de rejeitos, Pará'
WHERE name = 'SIMINERAL';

-- Fontes passam a ter metadados de prioridade e forma de acesso.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 50;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'publico';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sources_access_mode_check') THEN
    ALTER TABLE sources ADD CONSTRAINT sources_access_mode_check
      CHECK (access_mode IN ('publico', 'licenciado', 'referencia'));
  END IF;
END $$;

INSERT INTO sources (name, url, type, active, priority, access_mode)
VALUES (
  'Documentos importados',
  'https://cortex.invalid/documentos-importados',
  'scrape',
  false,
  100,
  'licenciado'
)
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name,
  active = false,
  priority = 100,
  access_mode = 'licenciado';

CREATE TABLE IF NOT EXISTS client_sources (
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  priority    INTEGER NOT NULL DEFAULT 50,
  is_thematic BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (client_id, source_id)
);

ALTER TABLE client_sources ADD COLUMN IF NOT EXISTS is_thematic BOOLEAN NOT NULL DEFAULT true;

-- Migra o vínculo antigo por nome para o novo relacionamento por UUID.
INSERT INTO client_sources (client_id, source_id, priority)
SELECT c.id, s.id, s.priority
FROM clients c
CROSS JOIN LATERAL unnest(COALESCE(c.feed_names, ARRAY[]::TEXT[])) AS f(name)
JOIN sources s ON s.name = f.name
ON CONFLICT (client_id, source_id) DO NOTHING;

-- Artigos importados podem não possuir URL (rádio, TV, impresso). A constraint
-- UNIQUE continua deduplicando URLs reais e o PostgreSQL permite vários NULLs.
ALTER TABLE articles ALTER COLUMN url DROP NOT NULL;
DROP INDEX IF EXISTS articles_url_unique_nonnull;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'articles'::regclass AND conname = 'articles_url_key'
  ) THEN
    ALTER TABLE articles ADD CONSTRAINT articles_url_key UNIQUE (url);
  END IF;
END $$;

ALTER TABLE articles ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_status TEXT NOT NULL DEFAULT 'parcial';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS canonical_fingerprint TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS enrichment_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS enrichment_attempted_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_content_status_check') THEN
    ALTER TABLE articles ADD CONSTRAINT articles_content_status_check
      CHECK (content_status IN ('integral', 'parcial', 'metadados'));
  END IF;
END $$;

DROP INDEX IF EXISTS articles_fingerprint_unique;
CREATE INDEX IF NOT EXISTS articles_fingerprint_lookup_idx
  ON articles(canonical_fingerprint);
CREATE INDEX IF NOT EXISTS articles_published_at_history_idx
  ON articles(published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS articles_source_published_history_idx
  ON articles(source_id, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS article_client_tags_client_article_idx
  ON article_client_tags(client_id, article_id);

-- Arquivos-fonte e suas ocorrências. Um artigo pode ter vindo simultaneamente
-- de RSS, PDF licenciado e mais de um caderno.
CREATE TABLE IF NOT EXISTS source_documents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename              TEXT NOT NULL,
  storage_path          TEXT NOT NULL,
  sha256                TEXT NOT NULL UNIQUE,
  document_type         TEXT NOT NULL DEFAULT 'desconhecido',
  status                TEXT NOT NULL DEFAULT 'enviado',
  page_count            INTEGER,
  imported_article_count INTEGER NOT NULL DEFAULT 0,
  error                 TEXT,
  metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at          TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_documents_type_check') THEN
    ALTER TABLE source_documents ADD CONSTRAINT source_documents_type_check
      CHECK (document_type IN ('caderno', 'artigo', 'desconhecido'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'source_documents_status_check') THEN
    ALTER TABLE source_documents ADD CONSTRAINT source_documents_status_check
      CHECK (status IN ('enviado', 'processando', 'concluido', 'revisao', 'erro'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS article_provenance (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id         UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  source_document_id UUID REFERENCES source_documents(id) ON DELETE CASCADE,
  source_id          UUID REFERENCES sources(id) ON DELETE SET NULL,
  acquisition_type   TEXT NOT NULL,
  page_start         INTEGER,
  page_end           INTEGER,
  original_reference TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS article_provenance_document_unique
  ON article_provenance(article_id, source_document_id)
  WHERE source_document_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS article_provenance_source_unique
  ON article_provenance(article_id, source_id, acquisition_type)
  WHERE source_document_id IS NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS article_provenance_article_idx
  ON article_provenance(article_id);

-- Classificação assistida: os campos já existentes continuam sendo a leitura
-- editorial; estes registram de onde veio e a confiança/justificativa.
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS classification_source TEXT;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS confidence NUMERIC(4,3);
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS impact_summary TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_classification_source_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_classification_source_check
      CHECK (classification_source IS NULL OR classification_source IN ('regra', 'ia', 'humano'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_confidence_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_confidence_check
      CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));
  END IF;
END $$;

-- Edição imutável por versão. period_month sempre guarda o primeiro dia do mês.
CREATE TABLE IF NOT EXISTS monthly_editions (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  period_month     DATE NOT NULL,
  version          INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'rascunho',
  summary_markdown TEXT,
  summary_data     JSONB NOT NULL DEFAULT '{}'::JSONB,
  counts           JSONB NOT NULL DEFAULT '{}'::JSONB,
  pdf_storage_path TEXT,
  error            TEXT,
  source_cutoff_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_at     TIMESTAMPTZ,
  UNIQUE (client_id, period_month, version)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_editions_status_check') THEN
    ALTER TABLE monthly_editions ADD CONSTRAINT monthly_editions_status_check
      CHECK (status IN ('rascunho', 'classificando', 'renderizando', 'concluido', 'erro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_editions_period_idx
  ON monthly_editions(period_month DESC, client_id, version DESC);

CREATE TABLE IF NOT EXISTS monthly_edition_items (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  edition_id              UUID NOT NULL REFERENCES monthly_editions(id) ON DELETE CASCADE,
  article_id              UUID NOT NULL REFERENCES articles(id) ON DELETE RESTRICT,
  position                INTEGER NOT NULL,
  section                 TEXT NOT NULL,
  cluster_key             TEXT,
  article_snapshot        JSONB NOT NULL,
  classification_snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (edition_id, article_id),
  UNIQUE (edition_id, position)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'monthly_edition_items_section_check') THEN
    ALTER TABLE monthly_edition_items ADD CONSTRAINT monthly_edition_items_section_check
      CHECK (section IN ('mencao_direta', 'cobertura_setorial', 'baixa_confianca'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS monthly_edition_items_edition_idx
  ON monthly_edition_items(edition_id, position);

-- Buckets privados; downloads e uploads usam URLs assinadas.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('source-documents', 'source-documents', false),
  ('monthly-clippings', 'monthly-clippings', false)
ON CONFLICT (id) DO UPDATE SET public = false;
