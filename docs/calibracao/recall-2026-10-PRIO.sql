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
  ('PRIO', 'refeito', 'Prio eleva a 17,15 milhões vendas barris de óleo no 3º tri, alta de 12,5%', 'https://www.cnnbrasil.com.br/infra/prio-eleva-a-1715-milhoes-vendas-barris-de-oleo-no-3o-tri-alta-de-125/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Produção de óleo equivalente por dia da Prio cresce 3,5% em setembro', 'https://valor.globo.com/empresas/noticia/2026/10/05/producao-de-oleo-equivalente-por-dia-da-prio-cresce-35percent-em-setembro.ghtml', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Prio (PRIO3) produz 192,6 mil barris por dia em setembro, alta de 3,5%', 'https://www.moneytimes.com.br/prio-prio3-produz-1926-mil-barris-por-dia-em-setembro-alta-de-35-apsa/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Produção da Prio avança em setembro e 3º trimestre alcança média diária de 191,6 mil boepd', 'https://www.brasil247.com/brasil/producao-da-prio-avanca-em-setembro-e-3o-trimestre-alcanca-media-diaria-de-1916-mil-boepd/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Prio (PRIO3), HBR (HBRE3), Helbor (HBOR3), LWSA (LWSA3) e mais: Veja os destaques das empresas', 'https://valorinveste.globo.com/mercados/renda-variavel/empresas/noticia/2026/10/06/prio-prio3-hbr-hbre3-helbor-hbor3-lwsa-lwsa3-e-mais-veja-os-destaques-das-empresas.ghtml', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'ANP encerra leilões de áreas de petróleo com arrecadação de R$ 3,6 bi', 'https://valor.globo.com/empresas/noticia/2026/10/07/prio-leva-blocos-magnetita-e-hematita-no-pre-sal-da-bacia-de-campos-diz-anp.ghtml', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Petrobras, Prio e Equinor arrematam áreas no pré-sal em busca de sinergias com seus ativos', 'https://www.moneytimes.com.br/petrobras-petr4-e-prio-prio3-estao-entre-vencedoras-de-leilao-de-7-blocos-do-pre-sal-lils/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Leilão do pré-sal termina com sete blocos arrematados e R$ 530 milhões em bônus', 'https://veja.abril.com.br/economia/leilao-do-pre-sal-termina-com-sete-blocos-arrematados-e-r-530-milhoes-em-bonus/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Leilão da ANP tem 7 dos 13 blocos arrematados e ágio de quase 500%', 'https://eixos.com.br/petroleo-e-gas/leiloes/leilao-da-anp-tem-7-dos-13-blocos-arrematados-e-agio-de-quase-500/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Empresa brasileira arremata duas áreas do pré-sal na porção capixaba da Bacia de Campos', 'https://www.folhavitoria.com.br/economia/empresa-brasileira-arremata-duas-areas-do-pre-sal-na-porcao-capixaba-da-bacia-de-campos/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Leilão da ANP arrecada R$ 3 bilhões com a venda de 49 blocos', 'https://agenciabrasil.ebc.com.br/economia/noticia/2026-10/leilao-da-anp-arrecada-r-3-bilhoes-com-venda-de-49-blocos', 'Setor', 'neutro'),
  ('PRIO', 'refeito', 'Quem levou e quem ficou sem nada nos leilões de petróleo da ANP', 'https://eixos.com.br/newsletters/comece-seu-dia/quem-levou-e-quem-ficou-sem-nada-nos-leiloes-de-petroleo-da-anp/', 'Cliente', 'neutro'),
  ('PRIO', 'refeito', 'Para ANP, leilões foram bem-sucedidos mesmo com pré-sal sem disputa e bônus concentrado na Petrobras', 'https://eixos.com.br/petroleo-e-gas/leiloes/anp-leiloes-bem-sucedidos-pre-sal-sem-disputa-bonus-petrobras/', 'Setor', 'neutro'),
  ('PRIO', 'refeito', 'BofA eleva preço-alvo da Prio (PRIO3) para R$ 74 e projeta dividendos bilionários', 'https://bpmoney.com.br/mercado/acoes/bofa-eleva-preco-alvo-prio-prio3-dividendos-bilionarios/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Brent deve rondar US$ 90 até o fim de 2026, com alívio limitado em 2027', 'https://www.canalrural.com.br/economia/brent-deve-rondar-us-90-ate-o-fim-de-2026-com-alivio-limitado-em-2027/', 'Setor', 'neutro'),
  ('PRIO', 'refeito', 'Petrobras (PETR4) e PRIO (PRIO3) fecham com alta, apesar de queda de petróleo', 'https://www.infomoney.com.br/mercados/petrobras-petr4-e-prio-prio3-petroleo-desempenho/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Cautela eleitoral e exterior derrubam Ibovespa; dólar avança e Nasdaq cai mais de 2%', 'https://exame.com/invest/mercados/cautela-eleitoral-e-exterior-derrubam-ibovespa-dolar-avanca-e-nasdaq-cai-mais-de-2/', 'Setor', 'neutro'),
  ('PRIO', 'refeito', 'Ações de petróleo: BTG avalia Petrobras (PETR4), Prio (PRIO3), Brava (BRAV3) e PetroReconcavo (RECV3)', 'https://www.estadao.com.br/einvestidor/cenarios-e-mercado/petrobras-prio-ou-brava-btg-revisa-acoes-de-petroleo-apos-queda-da-bolsa-e-aponta-oportunidades/', 'Cliente', 'positivo'),
  ('PRIO', 'refeito', 'Governo prorroga subvenção ao diesel e medida custará R$ 10,5 bi', 'https://valor.globo.com/brasil/noticia/2026/10/28/governo-prorroga-subvencao-ao-diesel-e-medida-custara-r-105-bi.ghtml', 'Setor', 'neutro'),
  ('PRIO', 'refeito', 'PRIO (PRIO3) pode crescer 14%; veja projeções do setor', 'https://www.suno.com.br/noticias/petroleo-gas-prio-prio3-balancos/', 'Cliente', 'positivo')
UNION ALL
SELECT d.client_name, 'entregue', d.title, d.url, NULL, NULL
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
  WHERE ref.cliente = 'PRIO'
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
