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
  ('ANTAQ', 'refeito', 'MPF e Cade pedem regras para coibir abusos de cobrança do SSE no caso BTP', 'https://agenciainfra.com/blog/mpf-e-cade-pedem-regras-para-coibir-abusos-de-cobranca-do-sse-no-caso-btp/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'Presidente da APS defende mais autonomia e cita atraso do Tecon 10', 'https://agenciainfra.com/blog/presidente-da-aps-defende-mais-autonomia-e-cita-atraso-do-tecon-10/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'Centronave alerta para risco ao transporte durante seca em Manaus', 'https://agenciainfra.com/blog/centronave-alerta-para-risco-ao-transporte-de-cargas-durante-seca-em-manaus/', 'Cliente', 'negativo'),
  ('ANTAQ', 'refeito', 'ANTAQ: técnicos sugerem punição de sobre-estadia irregular por contêiner', 'https://agenciainfra.com/blog/antaq-tecnicos-sugerem-punicao-de-sobre-estadia-irregular-por-conteiner/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'Terminal no Porto do Itaqui amplia movimentação de fertilizantes', 'https://agenciainfra.com/blog/terminal-no-porto-do-itaqui-amplia-movimentacao-de-fertilizantes/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'ANTAQ aprova edital para 1º arrendamento de contêiner em mais de dez anos', 'https://agenciainfra.com/blog/antaq-aprova-edital-para-1o-arrendamento-de-conteiner-em-mais-de-dez-anos/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'Rio Negro tem restrições, mas com situação menos severa que em 2023', 'https://agenciainfra.com/blog/rio-negro-tem-restricoes-mas-com-situacao-menos-severa-que-em-2023/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'ANTAQ: diretor-geral elogia parecer da AGU sobre substituições nas agências', 'https://agenciainfra.com/blog/antaq-diretor-geral-elogia-parecer-da-agu-sobre-substituicoes-nas-agencias/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'MPor quer prever mudança no perfil de carga nos portos pós-licitação', 'https://agenciainfra.com/blog/mpor-quer-prever-mudanca-no-perfil-de-carga-nos-portos-pos-licitacao/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'Proposta do MPor revê regras para prorrogação de contratos via reequilíbrio', 'https://agenciainfra.com/blog/proposta-do-mpor-reve-regras-para-prorrogacao-de-contratos-via-reequilibrio/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'Leilão único do NE pode mais que quadruplicar contêineres no Porto de Fortaleza', 'https://movimentoeconomico.com.br/economia/portos/2026/10/26/leilao-unico-do-ne-pode-mais-que-quadruplicar-conteineres-no-porto-de-fortaleza/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'Suape abre consulta pública para novo arrendamento portuário', 'https://movimentoeconomico.com.br/economia/portos/2026/10/26/suape-abre-consulta-publica-para-novo-arrendamento-portuario/', 'Setor', 'neutro'),
  ('ANTAQ', 'refeito', 'Padronização de cobrança de serviços em Tecons pode avançar na ANTAQ', 'https://agenciainfra.com/blog/padronizacao-de-cobranca-de-servicos-em-tecons-pode-avancar-na-antaq/', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'Tecon 10 e canal de Itajaí devem ganhar ritmo no governo após eleições', 'https://agenciainfra.com/blog/tecon-10-e-canal-de-itajai-devem-ganhar-ritmo-no-governo-apos-eleicoes/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'ANTAQ deve votar concessão do canal de acesso a Itajaí em novembro', 'https://agenciainfra.com/blog/antaq-deve-votar-concessao-do-canal-de-acesso-a-itajai-em-novembro/', 'Cliente', 'neutro'),
  ('ANTAQ', 'refeito', 'Por 5 a 0, STF mantém cobrança do SSE nos Tecons', 'https://www.portosenavios.com.br/noticias/portos-e-logistica/por-5-a-0-stf-mantem-cobranca-do-sse-nos-tecons', 'Cliente', 'positivo'),
  ('ANTAQ', 'refeito', 'Log-In opera no píer flutuante do Chibatão pela 1ª vez em 2026', 'https://www.portosenavios.com.br/noticias/portos-e-logistica/log-in-opera-no-pier-flutuante-do-chibatao-pela-1-vez-em-2026', 'Setor', 'neutro'),
  ('ANTAQ', 'refeito', 'Marinha autoriza novas profundidades e Suape amplia potencial de carga', 'https://movimentoeconomico.com.br/economia/portos/2026/10/16/marinha-autoriza-novas-profundidades-e-suape-amplia-potencial-de-carga/', 'Setor', 'positivo'),
  ('ANTAQ', 'refeito', 'Obra de R$ 71,15 milhões vai levar navios de 330 metros e cruzeiros a Cabedelo', 'https://movimentoeconomico.com.br/economia/portos/2026/10/23/obra-de-r-7115-milhoes-vai-levar-navios-de-330-metros-e-cruzeiros-a-cabedelo/', 'Setor', 'positivo'),
  ('ANTAQ', 'refeito', 'Fase final da dragagem do Porto de Natal sai com exigência de ouvir pescadores', 'https://movimentoeconomico.com.br/economia/portos/2026/10/29/fase-final-da-dragagem-do-porto-de-natal-sai-com-exigencia-de-ouvir-pescadores/', 'Setor', 'neutro')
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
  WHERE ref.cliente = 'ANTAQ'
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
