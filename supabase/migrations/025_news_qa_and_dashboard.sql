-- 025: QA rastreável da coleta, relevância contextual e painel sem truncamento.
-- Idempotente. Depende de 001..024.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Execuções públicas/manuais e automáticas compartilham o mesmo histórico.
CREATE TABLE IF NOT EXISTS fetch_runs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trigger_type      TEXT NOT NULL DEFAULT 'manual',
  status            TEXT NOT NULL DEFAULT 'pendente',
  total_sources     INTEGER NOT NULL DEFAULT 0,
  completed_sources INTEGER NOT NULL DEFAULT 0,
  parsed_count      INTEGER NOT NULL DEFAULT 0,
  inserted_count    INTEGER NOT NULL DEFAULT 0,
  updated_count     INTEGER NOT NULL DEFAULT 0,
  duplicate_count   INTEGER NOT NULL DEFAULT 0,
  error_count       INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fetch_runs_trigger_check') THEN
    ALTER TABLE fetch_runs ADD CONSTRAINT fetch_runs_trigger_check
      CHECK (trigger_type IN ('manual', 'schedule'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fetch_runs_status_check') THEN
    ALTER TABLE fetch_runs ADD CONSTRAINT fetch_runs_status_check
      CHECK (status IN ('pendente', 'executando', 'concluido', 'parcial', 'erro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fetch_runs_created_idx ON fetch_runs(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fetch_runs_single_active_idx
  ON fetch_runs ((true))
  WHERE status IN ('pendente', 'executando');
ALTER TABLE fetch_runs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS fetch_run_sources (
  run_id              UUID NOT NULL REFERENCES fetch_runs(id) ON DELETE CASCADE,
  source_id           UUID NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  status              TEXT NOT NULL DEFAULT 'pendente',
  parsed_count        INTEGER NOT NULL DEFAULT 0,
  inserted_count      INTEGER NOT NULL DEFAULT 0,
  updated_count       INTEGER NOT NULL DEFAULT 0,
  duplicate_count     INTEGER NOT NULL DEFAULT 0,
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  duration_ms         INTEGER,
  oldest_published_at TIMESTAMPTZ,
  latest_published_at TIMESTAMPTZ,
  error               TEXT,
  started_at          TIMESTAMPTZ,
  finished_at         TIMESTAMPTZ,
  PRIMARY KEY (run_id, source_id)
);
ALTER TABLE fetch_run_sources
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fetch_run_sources_status_check') THEN
    ALTER TABLE fetch_run_sources ADD CONSTRAINT fetch_run_sources_status_check
      CHECK (status IN ('pendente', 'executando', 'concluido', 'erro'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fetch_run_sources_pending_idx
  ON fetch_run_sources(run_id, status);
ALTER TABLE fetch_run_sources ENABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS claim_fetch_run_sources(UUID, INTEGER);
CREATE FUNCTION claim_fetch_run_sources(p_run_id UUID, p_limit INTEGER DEFAULT 4)
RETURNS TABLE (source_id UUID, attempt_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE fetch_run_sources AS target
  SET
    status = 'executando',
    started_at = NOW(),
    error = NULL,
    attempt_count = target.attempt_count + 1
  WHERE (target.run_id, target.source_id) IN (
    SELECT queued.run_id, queued.source_id
    FROM fetch_run_sources AS queued
    WHERE queued.run_id = p_run_id AND queued.status = 'pendente'
    ORDER BY queued.source_id
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 4)
  )
  RETURNING target.source_id, target.attempt_count;
END;
$$;
REVOKE ALL ON FUNCTION claim_fetch_run_sources(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_fetch_run_sources(UUID, INTEGER)
  TO service_role;

-- Regras editoriais versionadas. Cada grupo interno representa OR; todos os
-- grupos devem casar (AND entre grupos).
CREATE TABLE IF NOT EXISTS client_relevance_rules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label           TEXT NOT NULL,
  match_type      TEXT NOT NULL,
  required_groups JSONB NOT NULL DEFAULT '[]'::JSONB,
  excluded_terms  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  weight          INTEGER NOT NULL DEFAULT 1,
  version         INTEGER NOT NULL DEFAULT 1,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, label)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_relevance_rules_type_check') THEN
    ALTER TABLE client_relevance_rules ADD CONSTRAINT client_relevance_rules_type_check
      CHECK (match_type IN ('direta', 'setorial'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS client_relevance_rules_client_idx
  ON client_relevance_rules(client_id, active, version DESC);
ALTER TABLE client_relevance_rules ENABLE ROW LEVEL SECURITY;

-- Estado monitorado por artigo/cliente. Valores humanos continuam prevalecendo.
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS monitoring_status TEXT NOT NULL DEFAULT 'candidato';
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS match_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS match_reasons JSONB NOT NULL DEFAULT '[]'::JSONB;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS rule_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE article_client_tags ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'act_monitoring_status_check') THEN
    ALTER TABLE article_client_tags ADD CONSTRAINT act_monitoring_status_check
      CHECK (monitoring_status IN ('candidato', 'confirmado', 'revisao', 'excluido'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS act_client_status_article_idx
  ON article_client_tags(client_id, monitoring_status, article_id);
CREATE INDEX IF NOT EXISTS act_article_client_status_idx
  ON article_client_tags(article_id, client_id, monitoring_status);

ALTER TABLE articles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_error TEXT;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_duration_ms INTEGER;

UPDATE sources
SET last_success_at = last_fetched_at
WHERE last_success_at IS NULL AND last_fetched_at IS NOT NULL AND COALESCE(last_fetch_count, 0) > 0;

-- A fonte original deixa de apagar o artigo quando um cadastro de fonte é
-- removido. As demais origens permanecem em article_provenance.
ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_source_id_fkey;
ALTER TABLE articles ADD CONSTRAINT articles_source_id_fkey
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE RESTRICT;

-- Ingestão atômica por fonte. Preserva articles.source_id, enriquece somente
-- campos ausentes/mais completos e sempre acrescenta proveniência.
CREATE OR REPLACE FUNCTION ingest_source_articles(
  p_source_id UUID,
  p_acquisition_type TEXT,
  p_articles JSONB
)
RETURNS TABLE (
  article_id UUID,
  article_url TEXT,
  inserted BOOLEAN,
  enriched BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  existing articles%ROWTYPE;
  saved_id UUID;
  was_inserted BOOLEAN;
  was_enriched BOOLEAN;
  incoming_content TEXT;
BEGIN
  IF p_acquisition_type NOT IN ('rss', 'scrape') THEN
    RAISE EXCEPTION 'Tipo de aquisição inválido';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_articles, '[]'::JSONB))
  LOOP
    IF NULLIF(BTRIM(item->>'url'), '') IS NULL OR NULLIF(BTRIM(item->>'title'), '') IS NULL THEN
      CONTINUE;
    END IF;

    IF NULLIF(item->>'canonical_fingerprint', '') IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(
        hashtextextended(item->>'canonical_fingerprint', 0)
      );
    END IF;

    SELECT a.* INTO existing
    FROM articles a
    WHERE a.url = item->>'url'
       OR (
         NULLIF(item->>'canonical_fingerprint', '') IS NOT NULL
         AND a.canonical_fingerprint = item->>'canonical_fingerprint'
       )
    ORDER BY (a.url = item->>'url') DESC
    LIMIT 1;
    incoming_content := NULLIF(item->>'content', '');
    was_inserted := NOT FOUND;
    was_enriched := false;

    IF was_inserted THEN
      INSERT INTO articles (
        source_id, title, url, image_url, excerpt, content, content_status,
        author, publisher, published_at, canonical_fingerprint, last_seen_at
      ) VALUES (
        p_source_id,
        item->>'title',
        item->>'url',
        NULLIF(item->>'image_url', ''),
        NULLIF(item->>'excerpt', ''),
        incoming_content,
        COALESCE(NULLIF(item->>'content_status', ''), 'parcial'),
        NULLIF(item->>'author', ''),
        NULLIF(item->>'publisher', ''),
        NULLIF(item->>'published_at', '')::TIMESTAMPTZ,
        NULLIF(item->>'canonical_fingerprint', ''),
        NOW()
      )
      ON CONFLICT (url) DO NOTHING
      RETURNING id INTO saved_id;

      was_inserted := FOUND;
      IF NOT was_inserted THEN
        SELECT a.* INTO STRICT existing FROM articles a WHERE a.url = item->>'url';
      END IF;
    END IF;

    IF NOT was_inserted THEN
      saved_id := existing.id;
      was_enriched :=
        (existing.image_url IS NULL AND NULLIF(item->>'image_url', '') IS NOT NULL)
        OR (
          LENGTH(COALESCE(NULLIF(item->>'excerpt', ''), ''))
          > LENGTH(COALESCE(existing.excerpt, ''))
        )
        OR (existing.author IS NULL AND NULLIF(item->>'author', '') IS NOT NULL)
        OR (existing.publisher IS NULL AND NULLIF(item->>'publisher', '') IS NOT NULL)
        OR (existing.published_at IS NULL AND NULLIF(item->>'published_at', '') IS NOT NULL)
        OR (incoming_content IS NOT NULL AND LENGTH(incoming_content) > LENGTH(COALESCE(existing.content, '')));

      UPDATE articles SET
        image_url = COALESCE(articles.image_url, NULLIF(item->>'image_url', '')),
        excerpt = CASE
          WHEN LENGTH(COALESCE(NULLIF(item->>'excerpt', ''), '')) > LENGTH(COALESCE(articles.excerpt, ''))
            THEN NULLIF(item->>'excerpt', '')
          ELSE articles.excerpt
        END,
        content = CASE
          WHEN LENGTH(COALESCE(incoming_content, '')) > LENGTH(COALESCE(articles.content, ''))
            THEN incoming_content
          ELSE articles.content
        END,
        content_status = CASE
          WHEN incoming_content IS NOT NULL
               AND LENGTH(incoming_content) > LENGTH(COALESCE(articles.content, ''))
            THEN COALESCE(NULLIF(item->>'content_status', ''), articles.content_status)
          ELSE articles.content_status
        END,
        author = COALESCE(articles.author, NULLIF(item->>'author', '')),
        publisher = COALESCE(articles.publisher, NULLIF(item->>'publisher', '')),
        published_at = COALESCE(articles.published_at, NULLIF(item->>'published_at', '')::TIMESTAMPTZ),
        canonical_fingerprint = COALESCE(
          articles.canonical_fingerprint,
          NULLIF(item->>'canonical_fingerprint', '')
        ),
        last_seen_at = NOW()
      WHERE id = saved_id;
    END IF;

    INSERT INTO article_provenance (
      article_id, source_id, acquisition_type, original_reference
    ) VALUES (
      saved_id, p_source_id, p_acquisition_type, item->>'url'
    )
    ON CONFLICT DO NOTHING;

    article_id := saved_id;
    article_url := item->>'url';
    inserted := was_inserted;
    enriched := was_enriched;
    RETURN NEXT;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION ingest_source_articles(UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ingest_source_articles(UUID, TEXT, JSONB)
  TO service_role;

-- Remove o falso positivo "Pará" -> "para"; expressões regionais compostas são
-- mantidas nos termos específicos do cliente.
UPDATE clients
SET synonyms = REGEXP_REPLACE(synonyms, '(^|,)[[:space:]]*Pará[[:space:]]*(,|$)', '\1', 'gi')
WHERE name = 'SIMINERAL' AND synonyms IS NOT NULL;

-- Regras contextuais dos cinco clientes ativos.
INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["ONS","Operador Nacional do Sistema Elétrico","Operador Nacional do Sistema"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1 FROM clients WHERE name = 'ONS'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight,
  version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'operação e setor elétrico', 'setorial',
  '[["setor elétrico","energia elétrica","Sistema Interligado Nacional","curtailment","apagão","blecaute","linha de transmissão","despacho elétrico","segurança energética","usina hidrelétrica","usina eólica","usina solar","reservatórios hidrelétricos"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1 FROM clients WHERE name = 'ONS'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'transição energética e clima', 'setorial',
  '[["transição energética","emissões de gases","verificação de emissões","mercado de carbono","biocombustíveis","descarbonização"]]'::JSONB,
  ARRAY[]::TEXT[], 2, 1 FROM clients WHERE name = 'ONS'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["CCEE","Câmara de Comercialização de Energia Elétrica","Câmara de Comercialização"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1 FROM clients WHERE name = 'CCEE'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight,
  version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'mercado de energia', 'setorial',
  '[["comercialização de energia","mercado de energia","mercado livre de energia","PLD","preço de liquidação das diferenças","liquidação financeira","leilão de energia","consumidor livre","contratos de energia"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1 FROM clients WHERE name = 'CCEE'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["DAQ","Diretoria de Infraestrutura Aquaviária"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1 FROM clients
WHERE name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight,
  version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'infraestrutura aquaviária', 'setorial',
  '[["hidrovia","hidrovias","dragagem","desassoreamento","eclusa","navegação interior","transporte aquaviário","porto fluvial","canal de navegação","sinalização náutica"]]'::JSONB,
  ARRAY[]::TEXT[], 4, 1 FROM clients
WHERE name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'DNIT em contexto aquaviário', 'setorial',
  '[["DNIT"],["hidrovia","dragagem","eclusa","navegação","aquaviário","porto fluvial"]]'::JSONB,
  ARRAY['rodovia','pavimentação','viaduto','BR-']::TEXT[], 5, 1 FROM clients
WHERE name = 'DAQ — Diretoria de Infraestrutura Aquaviária/DNIT'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["SIMINERAL","Sindicato das Indústrias Minerais do Estado do Pará"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1 FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight,
  version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'mineração nacional', 'setorial',
  '[["mineração","indústria mineral","Agência Nacional de Mineração","ANM","lavra","CFEM","minério de ferro","bauxita","caulim","licenciamento mineral","barragem de rejeitos","minerais críticos","terras raras"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1 FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'commodities em contexto mineral', 'setorial',
  '[["ouro","cobre","níquel","manganês"],["mineração","mina","minério","lavra","ANM","jazida"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1 FROM clients WHERE name = 'SIMINERAL'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'aliases institucionais', 'direta',
  '[["SINDINFOR","Sindicato da Indústria de Software e da Tecnologia da Informação"]]'::JSONB,
  ARRAY[]::TEXT[], 8, 1 FROM clients WHERE name = 'SINDINFOR'
ON CONFLICT (client_id, label) DO UPDATE SET
  match_type = EXCLUDED.match_type, required_groups = EXCLUDED.required_groups,
  excluded_terms = EXCLUDED.excluded_terms, weight = EXCLUDED.weight,
  version = EXCLUDED.version, active = true, updated_at = NOW();

INSERT INTO client_relevance_rules
  (client_id, label, match_type, required_groups, excluded_terms, weight, version)
SELECT id, 'indústria de software nacional', 'setorial',
  '[["indústria de software","empresas de software","mercado de software","tecnologia da informação","economia digital","Lei do Bem","tributação de software","polo tecnológico","startups de tecnologia","Assespro"]]'::JSONB,
  ARRAY[]::TEXT[], 3, 1 FROM clients WHERE name = 'SINDINFOR'
ON CONFLICT (client_id, label) DO UPDATE SET
  required_groups = EXCLUDED.required_groups, excluded_terms = EXCLUDED.excluded_terms,
  weight = EXCLUDED.weight, version = EXCLUDED.version, active = true, updated_at = NOW();

-- Fontes quebradas passam a usar consultas por domínio; fontes institucionais
-- lentas deixam de raspar navegação sequencial.
UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=site%3Acanalenergia.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
  type = 'rss', access_mode = 'referencia'
WHERE name = 'Canal Energia';

UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=site%3Acartacapital.com.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
  type = 'rss', access_mode = 'referencia'
WHERE name = 'Carta Capital';

UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=site%3Agov.br%2Fdnit%20%28hidrovia%20OR%20dragagem%20OR%20aquaviario%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
  type = 'rss'
WHERE name = 'Institucional — DAQ/DNIT';

UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=site%3Asindinfor.org.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
  type = 'rss'
WHERE name = 'Institucional — SINDINFOR';

UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=site%3Asimineral.org.br&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
  type = 'rss'
WHERE name = 'Institucional — SIMINERAL';

UPDATE sources SET
  url = 'https://news.google.com/rss/search?q=%28hidrovia%20OR%20dragagem%20OR%20eclusa%20OR%20%22navegacao%20interior%22%20OR%20%22porto%20fluvial%22%20OR%20%22DNIT%20aquaviario%22%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419'
WHERE name = 'Google News — DAQ/DNIT Aquaviário';

-- Monitoramento por veículo com termos do portfólio evita que as cem manchetes
-- gerais do domínio enterrem as pautas setoriais.
INSERT INTO sources (name, url, type, active, is_general, priority, access_mode, categoria) VALUES
  ('Folha — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Afolha.uol.com.br%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('Estadão — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Aestadao.com.br%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('CNN Brasil — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Acnnbrasil.com.br%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('CBN — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Acbn.globo.com%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('Valor — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Avalor.globo.com%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('O Globo — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Aoglobo.globo.com%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20dragagem%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 100, 'referencia', 'imprensa'),
  ('Tribuna do Norte — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Atribunadonorte.com.br%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 95, 'referencia', 'imprensa'),
  ('Bom Dia SP/G1 SP — portfólio CORTEX',
   'https://news.google.com/rss/search?q=site%3Ag1.globo.com%2Fsp%20%28energia%20OR%20ONS%20OR%20CCEE%20OR%20mineracao%20OR%20software%20OR%20hidrovia%20OR%20emissoes%20OR%20carbono%20OR%20biocombustiveis%29&hl=pt-BR&gl=BR&ceid=BR%3Apt-419',
   'rss', true, false, 95, 'referencia', 'imprensa')
ON CONFLICT (url) DO UPDATE SET
  name = EXCLUDED.name, active = true, is_general = false,
  priority = EXCLUDED.priority, access_mode = EXCLUDED.access_mode,
  categoria = EXCLUDED.categoria;

INSERT INTO client_sources (client_id, source_id, priority, is_thematic)
SELECT c.id, s.id, s.priority, false
FROM clients c
JOIN sources s ON s.name LIKE '%— portfólio CORTEX'
WHERE c.active = true
ON CONFLICT (client_id, source_id) DO UPDATE SET
  priority = EXCLUDED.priority, is_thematic = false;
