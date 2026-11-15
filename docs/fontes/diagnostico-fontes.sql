-- Diagnóstico de todas as fontes: o que cada uma rendeu nos últimos 30 dias.
-- Cole no SQL Editor do Supabase. Só leitura. Até 100 linhas por página:
-- troque o OFFSET (0, 100, 200…) para ver o resto.
--
-- Colunas:
--   execucoes        vezes que a fonte entrou numa coleta nos 30 dias (denominador)
--   com_erro         execuções que terminaram em erro
--   vazias           execuções que responderam sem nenhum item
--   itens_lidos      soma de itens lidos no feed (inclui repetidos entre coletas)
--   novas            matérias novas inseridas
--   marcadas         matérias da fonte marcadas para algum cliente (30 dias)
--   cita_cliente     dessas, quantas citam o cliente
--   google_pendente  matérias com link do Google News ainda não resolvido
--   ultimo_erro      texto do erro mais recente
--   veredito         leitura automática (abaixo); confira antes de desligar
--
-- Vereditos:
--   QUEBRADA       metade ou mais das execuções com erro
--   MUDA           nenhuma execução trouxe item (feed vazio ou bloqueado)
--   SEM RELEVÂNCIA trouxe matérias novas, nenhuma marcada para cliente
--   GOOGLE PRESO   mais da metade das marcadas sem link resolvido
--   OK             o resto
WITH janela AS (SELECT NOW() - INTERVAL '30 days' AS desde),
execs AS (
  SELECT frs.source_id,
         count(*) AS execucoes,
         count(*) FILTER (WHERE frs.status = 'erro') AS com_erro,
         count(*) FILTER (WHERE frs.status = 'concluido' AND COALESCE(frs.parsed_count, 0) = 0) AS vazias,
         COALESCE(sum(frs.parsed_count), 0) AS itens_lidos,
         COALESCE(sum(frs.inserted_count), 0) AS novas
  FROM fetch_run_sources frs
  JOIN fetch_runs fr ON fr.id = frs.run_id, janela
  WHERE fr.created_at >= janela.desde
  GROUP BY frs.source_id
),
tags AS (
  SELECT a.source_id,
         count(DISTINCT a.id) AS marcadas,
         count(DISTINCT a.id) FILTER (WHERE t.cita_cliente) AS cita_cliente,
         count(DISTINCT a.id) FILTER (WHERE a.url LIKE 'https://news.google.com/%' AND a.resolved_url IS NULL) AS google_pendente
  FROM articles a
  JOIN article_client_tags t ON t.article_id = a.id AND t.monitoring_status <> 'excluido', janela
  WHERE a.fetched_at >= janela.desde
  GROUP BY a.source_id
)
SELECT s.name,
       s.active,
       s.is_general,
       COALESCE(e.execucoes, 0) AS execucoes,
       COALESCE(e.com_erro, 0) AS com_erro,
       COALESCE(e.vazias, 0) AS vazias,
       COALESCE(e.itens_lidos, 0) AS itens_lidos,
       COALESCE(e.novas, 0) AS novas,
       COALESCE(t.marcadas, 0) AS marcadas,
       COALESCE(t.cita_cliente, 0) AS cita_cliente,
       COALESCE(t.google_pendente, 0) AS google_pendente,
       left(s.last_fetch_error, 120) AS ultimo_erro,
       CASE
         WHEN COALESCE(e.execucoes, 0) = 0 THEN 'SEM EXECUÇÃO NOS 30 DIAS'
         WHEN e.com_erro * 2 >= e.execucoes THEN 'QUEBRADA'
         WHEN e.itens_lidos = 0 THEN 'MUDA'
         WHEN e.novas > 0 AND COALESCE(t.marcadas, 0) = 0 THEN 'SEM RELEVÂNCIA'
         WHEN COALESCE(t.marcadas, 0) > 0 AND t.google_pendente * 2 > t.marcadas THEN 'GOOGLE PRESO'
         ELSE 'OK'
       END AS veredito,
       s.url
FROM sources s
LEFT JOIN execs e ON e.source_id = s.id
LEFT JOIN tags t ON t.source_id = s.id
WHERE s.active
ORDER BY
  CASE
    WHEN COALESCE(e.execucoes, 0) = 0 THEN 0
    WHEN e.com_erro * 2 >= e.execucoes THEN 1
    WHEN e.itens_lidos = 0 THEN 2
    ELSE 3
  END,
  COALESCE(t.marcadas, 0) DESC,
  s.name
LIMIT 100 OFFSET 0;
