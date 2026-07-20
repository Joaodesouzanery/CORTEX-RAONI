-- 018: Curadoria — tagueamento reputacional por (artigo, cliente) + tipo de fonte.
--
-- Por quê por (artigo, cliente) e não no artigo: tom, relevância e "cita o
-- cliente diretamente" são leituras RELATIVAS ao cliente — a mesma matéria pode
-- ser positiva para um cliente e neutra/sob-outro-protagonista para outro. É a
-- relação artigo↔cliente, não uma propriedade global do artigo.
--
-- `sources.categoria` (tipo de fonte) é propriedade da FONTE, não da relação:
-- imprensa | institucional | agente. Alimenta o "Por tipo de fonte" do panorama.
--
-- Tudo determinístico e sem IA — o painel/dossiê contam a partir daqui.
-- Idempotente. Depende de 001 (articles), 003 (clients).

-- (1) Tipo de fonte ----------------------------------------------------------
ALTER TABLE sources ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'imprensa';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sources_categoria_check') THEN
    ALTER TABLE sources
      ADD CONSTRAINT sources_categoria_check
      CHECK (categoria IN ('imprensa', 'institucional', 'agente'));
  END IF;
END $$;

-- Semeia como 'institucional' as fontes já nomeadas "Institucional — …"
-- (mesma heurística que o dossiê usa hoje), sem tocar nas já classificadas.
UPDATE sources SET categoria = 'institucional'
  WHERE name ILIKE 'Institucional%' AND categoria = 'imprensa';

-- (2) Tags reputacionais por (artigo, cliente) --------------------------------
CREATE TABLE IF NOT EXISTS article_client_tags (
  article_id   UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  client_id    UUID NOT NULL REFERENCES clients(id)  ON DELETE CASCADE,
  tom          TEXT CHECK (tom IN ('positivo', 'neutro', 'negativo', 'critico')),
  relevancia   TEXT CHECK (relevancia IN ('alta', 'media', 'baixa')),
  cita_cliente BOOLEAN,               -- true = cita o cliente; false = tema sob outro protagonista
  tema         TEXT,                  -- rótulo do tema/cluster (texto livre por ora)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, client_id)
);

CREATE INDEX IF NOT EXISTS act_client_idx ON article_client_tags(client_id);
