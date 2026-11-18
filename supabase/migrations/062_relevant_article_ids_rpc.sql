-- Corrige o "canceling statement due to statement timeout" na lista de
-- notícias sem cliente selecionado (aba "Cliente + Setor", sem client_id).
--
-- Causa: src/app/api/articles/route.ts montava
--   articles!inner(article_client_tags!inner(...)) com filtro
--   article_client_tags.monitoring_status IN (...) e SEM client_id. O
--   PostgREST traduz isso num JOIN que materializa o cruzamento inteiro
--   (todos os clientes) antes do ORDER BY/LIMIT, porque não há como empurrar
--   o corte para antes do join. Os índices existentes em article_client_tags
--   (act_client_idx, act_client_status_article_idx,
--   act_article_client_status_idx, article_client_tags_client_article_idx —
--   018/023/025/052) são todos client_id-líder ou article_id-líder: bons
--   para "um cliente" ou para checar "este artigo tem status X", não para
--   "todo artigo com status X, sem saber o cliente". O catch-up de 17/11
--   (1627 matérias novas de uma vez, acervo parado desde 15/09) multiplicou
--   linhas o bastante para o plano ruim estourar.
--
-- Correção: uma função SQL que reescreve a mesma pergunta como EXISTS, não
-- como JOIN. Com EXISTS, o planejador pode varrer articles por published_at
-- (índice articles_published_at_history_idx, 023) na ordem do ORDER BY, e
-- para cada linha fazer uma sonda de índice em article_client_tags via
-- act_article_client_status_idx (article_id, client_id, monitoring_status;
-- 025) — nested loop indexado, não hash/merge join sobre a tabela inteira.
-- O mesmo molde de news_hero_counts (052): STABLE SECURITY DEFINER com
-- SET statement_timeout como cinto de segurança, REVOKE de anon/authenticated.
--
-- Escopo: só a pergunta "quais ids, em que ordem" — devolve id e
-- published_at; a rota continua buscando as colunas completas (sources,
-- article_provenance) numa segunda consulta plana por .in('id', ids), sem
-- repetir o problema porque aí não há filtro em tabela relacionada.

CREATE OR REPLACE FUNCTION relevant_article_ids(
  p_cutoff TIMESTAMPTZ,
  p_before TIMESTAMPTZ,
  p_statuses TEXT[],
  -- NULL = sem filtro de bloco; TRUE = só cita_cliente; FALSE = só setor
  -- (cita_cliente nulo ou falso — cita_cliente é NULLABLE desde a 018).
  p_cita_cliente BOOLEAN,
  p_limit INT,
  p_offset INT
)
RETURNS TABLE (id UUID, published_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '20s'
AS $$
  SELECT a.id, a.published_at
  FROM articles a
  WHERE a.published_at >= p_cutoff
    AND (p_before IS NULL OR a.published_at <= p_before)
    AND EXISTS (
      SELECT 1 FROM article_client_tags t
      WHERE t.article_id = a.id
        AND t.monitoring_status = ANY (p_statuses)
        AND (
          p_cita_cliente IS NULL
          OR (p_cita_cliente IS TRUE AND t.cita_cliente IS TRUE)
          OR (p_cita_cliente IS FALSE AND COALESCE(t.cita_cliente, FALSE) = FALSE)
        )
    )
  ORDER BY a.published_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION relevant_article_ids(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], BOOLEAN, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION relevant_article_ids(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[], BOOLEAN, INT, INT) TO service_role;

-- Estatísticas desatualizadas pioram exatamente esse tipo de plano; nenhuma
-- migration roda ANALYZE depois de upsert em massa, e o catch-up de 17/11
-- foi o maior já feito.
ANALYZE articles;
ANALYZE article_client_tags;
