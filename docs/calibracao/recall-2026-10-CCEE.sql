-- Calibração 2026-10: quanto o Cortex chega do que foi entregue ao cliente.
-- Gerado por: node scripts/build-calibration-sql.mjs 2026-10
-- Cole no SQL Editor do Supabase. Só leitura: não grava nada.
--
-- Referência (denominador), embutida abaixo:
--   refeito             150 notícias verificadas (docs/relatorios-refeitos/2026-10), com bloco e tom
--   clipping-fornecedor 510 manchetes do clipping diário da ONS (sem link)
--   entregue            o que está em delivered_report_items para o mês (052b), exceto a variante 'refeito'
-- Janela de busca no acervo: publicadas de 2026-10-01 −5 dias até 2026-11-01 +7 dias (data de
-- publicação do veículo e do RSS divergem; o clipping registra no dia seguinte).
--
-- Casamento: URL normalizada (sem protocolo, www, query e barra final), contra url e resolved_url;
-- ou as 7 primeiras palavras do título, sem acento, com pelo menos 4 palavras. Título de impresso
-- reescrito não casa: "coletadas" é PISO, não teto.
--
-- Colunas:
--   itens          denominador da linha
--   coletadas      a matéria existe em articles
--   etiquetadas    existe etiqueta para o cliente, fora 'excluido'
--   em_revisao     dessas, quantas estão em 'revisao' (aparecem na aba Setor, não entram no relatório)
--   bloco_ok       Cliente/Setor da etiqueta = do refeito (cita_cliente), sobre as etiquetadas com bloco
--   tom_ok         tom da etiqueta = do refeito, sobre as etiquetadas com tom no refeito
-- Totais por cliente e origem; cabe nas 100 linhas do SQL Editor.

WITH ref(cliente, origem, titulo, url, bloco, tom) AS (
VALUES
  ('CCEE', 'refeito', 'Minas e Energia e CCEE listam usinas que serão compensadas por cortes', 'https://economia.uol.com.br/noticias/redacao/2026/10/05/lista-aponta-usinas-que-podem-buscar-compensacao-por-cortes.ghtm', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE divulga lista de usinas solares e eólicas elegíveis para compensação por cortes de geração; saiba quais são elas', 'https://canalsolar.com.br/ccee-lista-usinas-solares-eolicas-compensacao-cortes-de-geracao/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'Abertura do mercado livre demanda solução para contratos e encargos, diz CCEE', 'https://megawhat.uol.com.br/regulacao/abertura-do-mercado-livre-exige-solucao-para-contratos-e-encargos-diz-ccee/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE defende regras mais simples para migração ao mercado livre de energia', 'https://www.canalenergia.com.br/noticias/53357533/ccee-defende-regras-mais-simples-para-migracao-ao-mercado-livre-de-energia', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE volta a reapurar ressarcimentos de CCEAR-Ds e CERs', 'https://www.canalenergia.com.br/noticias/53357644/ccee-volta-a-reapurar-ressarcimentos-de-ccear-ds-e-cers', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', 'ONS, CCEE e EPE abrem código de novo modelo', 'https://www.canalenergia.com.br/noticias/53358182/ons-ccee-e-epe-abrem-codigo-de-novo-modelo', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'ONS, CCEE e EPE abrem código de novo modelo computacional para substituir NEWAVE e DECOMP em 2028', 'https://cenarioenergia.com.br/2026/10/16/ons-ccee-epe-codigo-aberto-github-novo-modelo-pld-newave-decomp/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE reduz em 75% o prazo médio para processar pedidos de recontabilização', 'https://www.canalenergia.com.br/noticias/53358228/ccee-reduz-em-75-o-prazo-medio-para-processar-pedidos-de-recontabilizacao', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE destaca papel estratégico do armazenamento de energia durante ABSOLAR Storage Leaders', 'https://www.revistamundoeletrico.com.br/armazenamento/ccee-destaca-papel-estrategico-do-armazenamento-de-energia-durante-absolar-storage-leaders/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', '1º leilão de gás da União tem 36 empresas habilitadas', 'https://www.poder360.com.br/poder-energia/1o-leilao-de-gas-da-uniao-tem-36-empresas-habilitadas/', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', '1º Leilão de Gás Natural da União terá 36 empresas participantes', 'https://agenciainfra.com/blog/1o-leilao-de-gas-natural-da-uniao-tera-36-empresas-participantes/', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', 'Gás da União vai a leilão e mede quanto a indústria paga por desconto', 'https://eixos.com.br/newsletters/comece-seu-dia/gas-da-uniao-vai-a-leilao-e-mede-quanto-a-industria-paga-por-desconto/', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', 'Demanda respondeu ao preço mais barato no leilão de gás, dizem especialistas', 'https://valor.globo.com/empresas/noticia/2026/10/22/demanda-respondeu-ao-preco-mais-barato-no-leilao-de-gas-dizem-especialistas.ghtml', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'Leilão de gás: grandes da mineração e metalurgia arrematam 320 mil m³/dia', 'https://agenciainfra.com/blog/mineracao-e-metalurgia-levam-os-32-lotes-no-leilao-de-gas-da-uniao/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'Vale, CSN e Gerdau compram gás da União em leilão inédito da PPSA', 'https://cenarioenergia.com.br/2026/10/22/vale-csn-e-gerdau-compram-gas-da-uniao-em-leilao-inedito-da-ppsa/', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'Braskem é a única compradora com CNPJ do Nordeste no 1º leilão de gás da União', 'https://movimentoeconomico.com.br/petroleo-e-gas/2026/10/22/braskem-e-a-unica-compradora-com-cnpj-do-nordeste-no-1o-leilao-de-gas-da-uniao/', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', 'Leilão de gás da União é disputado e preço cai', 'https://economia.uol.com.br/noticias/estadao-conteudo/2026/10/23/leilao-de-gas-da-uniao-e-disputado-e-preco-cai.htm', 'Cliente', 'positivo'),
  ('CCEE', 'refeito', 'CCEE determina desligamento da IBS e mantém decisões contra Electra e 2W', 'https://megawhat.uol.com.br/economia-e-politica/empresas/ccee-determina-desligamento-da-ibs-e-mantem-decisoes-contra-electra-e-2w/', 'Cliente', 'neutro'),
  ('CCEE', 'refeito', 'ONS aponta afluência superior à média no Sul e Sudeste/Centro-Oeste ao final de outubro após setembro histórico', 'https://cenarioenergia.com.br/2026/10/05/ons-aponta-afluencia-superior-media-sul-sudeste-outubro/', 'Setor', 'neutro'),
  ('CCEE', 'refeito', 'Análise: Leilão da PPSA confirma apetite da indústria por gás mais barato', 'https://valor.globo.com/empresas/noticia/2026/10/22/analise-leilao-da-ppsa-confirma-apetite-da-industria-por-gas-mais-barato.ghtml', 'Setor', 'positivo')
UNION ALL
SELECT d.client_name, CASE WHEN d.variant = 'pdf-final' THEN 'entregue-pdf' ELSE 'entregue' END, d.title, d.url, NULL, NULL
FROM delivered_report_items d
WHERE d.period_month = DATE '2026-10-01' AND d.variant <> 'refeito'
),
r AS (
  SELECT ref.*, c.id AS client_id,
         row_number() OVER () AS rid,
         NULLIF(regexp_replace(regexp_replace(lower(ref.url), '^https?://(www\d?\.|m\.)?', ''), '([?#].*$)|(/+$)', '', 'g'), '') AS uk,
         array_to_string((regexp_split_to_array(trim(regexp_replace(translate(lower(ref.titulo), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g')), ' '))[1:7], ' ') AS tk
  FROM ref
  LEFT JOIN clients c ON c.name = ref.cliente OR c.name LIKE ref.cliente || ' %'
  WHERE ref.cliente = 'CCEE'
),
-- MATERIALIZED: as chaves do acervo são calculadas UMA vez. A versão
-- anterior casava cada referência numa subconsulta correlacionada e
-- recalculava as regex do acervo inteiro por referência (timeout no SQL
-- Editor do Supabase, relatado em 17/11/2026).
art AS MATERIALIZED (
  SELECT a.id,
         NULLIF(regexp_replace(regexp_replace(lower(a.url), '^https?://(www\d?\.|m\.)?', ''), '([?#].*$)|(/+$)', '', 'g'), '') AS uk,
         NULLIF(regexp_replace(regexp_replace(lower(a.resolved_url), '^https?://(www\d?\.|m\.)?', ''), '([?#].*$)|(/+$)', '', 'g'), '') AS uk_resolved,
         array_to_string((regexp_split_to_array(trim(regexp_replace(translate(lower(a.title), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g')), ' '))[1:7], ' ') AS tk
  FROM articles a
  WHERE a.published_at >= TIMESTAMPTZ '2026-10-01 00:00-03' - INTERVAL '5 days'
    AND a.published_at <  TIMESTAMPTZ '2026-11-01 00:00-03' + INTERVAL '7 days'
),
-- Três casamentos por igualdade (hash join), não OR numa subconsulta.
hits AS (
  SELECT r.rid, art.id FROM r JOIN art ON r.uk IS NOT NULL AND art.uk = r.uk
  UNION ALL
  SELECT r.rid, art.id FROM r JOIN art ON r.uk IS NOT NULL AND art.uk_resolved = r.uk
  UNION ALL
  SELECT r.rid, art.id FROM r JOIN art ON array_length(string_to_array(r.tk, ' '), 1) >= 4 AND art.tk = r.tk
),
best AS (
  SELECT DISTINCT ON (rid) rid, id FROM hits ORDER BY rid, id
),
m AS (
  SELECT r.*, best.id AS article_id FROM r LEFT JOIN best ON best.rid = r.rid
),
t AS (
  SELECT m.*, tag.cita_cliente, tag.tom AS tag_tom, tag.monitoring_status
  FROM m
  LEFT JOIN article_client_tags tag
    ON tag.article_id = m.article_id AND tag.client_id = m.client_id AND tag.monitoring_status <> 'excluido'
)
SELECT cliente,
       origem,
       count(*) AS itens,
       count(article_id) AS coletadas,
       round(100.0 * count(article_id) / NULLIF(count(*), 0)) AS pct_coletadas,
       count(monitoring_status) AS etiquetadas,
       round(100.0 * count(monitoring_status) / NULLIF(count(*), 0)) AS pct_etiquetadas,
       count(*) FILTER (WHERE monitoring_status = 'revisao') AS em_revisao,
       count(*) FILTER (WHERE bloco IS NOT NULL AND monitoring_status IS NOT NULL
                          AND (bloco = 'Cliente') = COALESCE(cita_cliente, FALSE)) || '/' ||
         count(*) FILTER (WHERE bloco IS NOT NULL AND monitoring_status IS NOT NULL) AS bloco_ok,
       count(*) FILTER (WHERE tom IS NOT NULL AND monitoring_status IS NOT NULL
                          AND (tom = tag_tom OR (tom = 'negativo' AND tag_tom = 'critico'))) || '/' ||
         count(*) FILTER (WHERE tom IS NOT NULL AND monitoring_status IS NOT NULL) AS tom_ok
FROM t
GROUP BY cliente, origem
ORDER BY cliente, origem;
