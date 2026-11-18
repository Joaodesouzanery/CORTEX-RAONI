-- Curadoria do lote de 17/11/2026: a coleta ficou parada de 15/09 a 14/11 e,
-- quando o botão "Buscar Notícias" rodou de novo, entraram 1627 matérias de
-- uma vez (139/139 fontes). Este SQL responde "vieram bem classificadas?"
-- sem exigir acesso direto ao banco por aqui — cole no SQL Editor do
-- Supabase. Só leitura: não grava nada.
--
-- Mesma lição do scripts/build-calibration-sql.mjs: MATERIALIZED e igualdade,
-- nunca subconsulta correlacionada sobre o acervo inteiro (isso já deu
-- timeout nesse mesmo SQL Editor em 17/11). Aqui nem precisa: tudo roda sobre
-- a janela das últimas 48h, pequena, com os índices article_id/client_id já
-- existentes.
--
-- Como ler:
--   1) VOLUME — quanto entrou, por cliente, status e quem decidiu
--      (classification_source: regra determinística vs 'tema' do
--      evaluateThemeOnly vs 'ia' vs 'humano'). 'revisao' concentrado em
--      classification_source = 'tema' é esperado: é o fallback de setor de
--      peso baixo (Fase 21) — não é erro, é exatamente pra isso que existe.
--      Mas se 'confirmado'/'candidato' tiver muita linha com match_score
--      baixo, vale olhar a amostra abaixo.
--   2) AMOSTRA — 3 matérias por (cliente, tema) em 'revisao', para o dono
--      checar rapidamente se o termo que casou faz sentido com o título.
--      match_reasons mostra o termo exato que disparou a regra ou o tema.
--   3) FONTES COM ERRO — as três falhas vistas na tela (2x Planalto, 1x
--      Logweb), com a mensagem de erro e quantas tentativas, pra decidir se
--      abre um chamado de curadoria-de-fontes ou se foi instabilidade do dia.

-- 1) VOLUME por cliente, status e origem da decisão, últimas 48h (fetched_at).
SELECT
  c.name AS cliente,
  t.monitoring_status,
  t.classification_source,
  count(*) AS matérias,
  round(avg(t.match_score)::numeric, 1) AS match_score_medio,
  count(*) FILTER (WHERE t.match_score IS NULL OR t.match_score < 0.3) AS score_baixo_ou_nulo
FROM article_client_tags t
JOIN clients c ON c.id = t.client_id
JOIN articles a ON a.id = t.article_id
WHERE a.fetched_at >= NOW() - INTERVAL '48 hours'
  AND t.monitoring_status <> 'excluido'
GROUP BY c.name, t.monitoring_status, t.classification_source
ORDER BY c.name, t.monitoring_status, matérias DESC;

-- 2) AMOSTRA de 'revisao' por cliente e tema: 3 linhas de cada, pra ler o
-- título contra o termo que casou (match_reasons). MATERIALIZED pra não
-- recalcular o row_number por linha da janela.
WITH recentes AS MATERIALIZED (
  SELECT
    c.name AS cliente,
    t.tema,
    a.title,
    a.publisher,
    a.published_at,
    t.match_score,
    t.match_reasons,
    row_number() OVER (PARTITION BY c.name, t.tema ORDER BY a.published_at DESC) AS rn
  FROM article_client_tags t
  JOIN clients c ON c.id = t.client_id
  JOIN articles a ON a.id = t.article_id
  WHERE a.fetched_at >= NOW() - INTERVAL '48 hours'
    AND t.monitoring_status = 'revisao'
)
SELECT cliente, tema, title, publisher, published_at, match_score, match_reasons
FROM recentes
WHERE rn <= 3
ORDER BY cliente, tema, published_at DESC;

-- 3) FONTES com erro na coleta mais recente (as 3 vistas na tela: 2x
-- Planalto — Decreto, 1x Logweb). attempt_count > 1 e error ainda presente
-- = falha persistente, não soluço de um request.
SELECT
  s.name AS fonte,
  s.url,
  frs.error,
  frs.attempt_count,
  frs.started_at,
  frs.finished_at,
  s.last_fetch_error,
  s.last_success_at
FROM fetch_run_sources frs
JOIN sources s ON s.id = frs.source_id
JOIN fetch_runs fr ON fr.id = frs.run_id
WHERE fr.started_at >= NOW() - INTERVAL '48 hours'
  AND frs.error IS NOT NULL
ORDER BY fr.started_at DESC, s.name;
