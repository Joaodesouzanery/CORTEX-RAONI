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
  ('SIMINERAL', 'refeito', 'ANM aprova revisão de Agenda Regulatória e prazo de vigência', 'https://brasil61.com/n/anm-aprova-revisao-de-agenda-regulatoria-e-prazo-de-vigencia-mine261085.amp', 'Setor', 'neutro'),
  ('SIMINERAL', 'refeito', 'Minerais estratégicos colocam o Pará no mapa da transição energética', 'https://www.oliberal.com/economia/minerais-estrategicos-colocam-o-para-no-mapa-da-transicao-energetica-1.1174700', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Polícia Federal prende seis pessoas em ação contra garimpo ilegal no Pará', 'https://www.tnh1.com.br/noticia/nid/policia-federal-prende-seis-pessoas-em-acao-contra-garimpo-ilegal-no-para/', 'Setor', NULL),
  ('SIMINERAL', 'refeito', 'Mina de ouro no Pará aumenta produção em 22%, extrai quase 45 mil onças em apenas três meses (...)', 'https://clickpetroleoegas.com.br/mina-de-ouro-no-para-aumenta-producao-em-22-extrai-quase-45-mil-oncas-em-apenas-tres-meses-e-aproxima-mineradora-canadense-da-meta-de-190-mil-oncas-para-2026-com-operacao-em-expansao-no-fpsv/', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Exportações minerais do Pará crescem 23,5% e somam US$ 8,67 bilhões no semestre', 'https://www.oliberal.com/economia/exportacoes-minerais-do-para-crescem-23-5-e-somam-us-8-67-bilhoes-no-semestre-1.1182241', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Exportações minerais do Pará avançam 23,5% em 2026', 'https://dol.com.br/noticias/para/965401/exportacoes-minerais-do-para-avancam-235-em-2026', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Nova frota do trem entre Pará e Maranhão deve entrar em operação até 2027', 'https://www.oliberal.com/economia/nova-frota-do-trem-entre-para-e-maranhao-deve-entrar-em-operacao-ate-2027-1.1182275', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Exportações minerais do Pará crescem 23,5% e alcançam US$ 8,67 bilhões no primeiro semestre de 2026', 'https://minerabrasil.com.br/exportacoes-minerais-do-para-crescem-235-e-alcancam-us-867-bilhoes-no-primeiro-semestre-de-2026/2026/10/14/', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Pará exporta US$ 8,67 bilhões no primeiro semestre', 'https://brasilmineral.com.br/noticias/para-exporta-us-867-bilhoes-no-primeiro-semestre', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Pará exporta US$ 8,67 bilhões no primeiro semestre', 'https://brasil61.com/n/para-exporta-us-8-67-bilhoes-no-primeiro-semestre-mine261091', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Mineradora canadense avança sobre uma área estratégica no Pará e prepara o próximo passo de um projeto de ouro (...)', 'https://clickpetroleoegas.com.br/mineradora-canadense-avanca-sobre-uma-area-estrategica-no-para-e-prepara-o-proximo-passo-de-um-projeto-de-ouro-que-pode-processar-5-500-toneladas-por-dia-vml97', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Produção mineral do Pará cresce mais de 50% entre 2010 e 2024, aponta relatório', 'https://www.oliberal.com/economia/carta-santarem-simineral-lanca-relatorio-sobre-producao-mineral-do-para-1.1184823', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'Simineral lança Carta Santarém com dados ESG', 'https://brasilmineral.com.br/noticias/simineral-lanca-carta-santarem-com-dados-esg', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'STF suspende licença de instalação do projeto Volta Grande, da Belo Sun', 'https://brasilmineral.com.br/noticias/stf-suspende-licenca-de-instalacao-do-projeto-volta-grande-da-belo-sun', 'Setor', NULL),
  ('SIMINERAL', 'refeito', 'Hydro troca parte do carvão da Alunorte por caroço de açaí', 'https://brasilmineral.com.br/noticias/hydro-troca-parte-do-carvao-da-alunorte-por-caroco-de-acai', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Mineradora identifica 21 novos alvos de ouro e cobre no Pará e encontra amostras de rocha com até 45 gramas de ouro por tonelada', 'https://clickpetroleoegas.com.br/mineradora-identifica-21-novos-alvos-de-ouro-e-cobre-no-para-e-encontra-amostras-de-rocha-com-ate-45-gramas-de-ouro-por-tonelada-asaf04/', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Mineração no Pará ganha relatório ESG com mais de 40 indicadores que abrangem 90% da produção mineral', 'https://clickpetroleoegas.com.br/mineracao-no-para-ganha-relatorio-esg-com-mais-de-40-indicadores-que-abrangem-90-da-producao-mineral-ama01', 'Cliente', 'positivo'),
  ('SIMINERAL', 'refeito', 'MRN prepara infraestrutura de energia para sustentar operações de bauxita no Pará', 'https://diariodopara.com.br/conteudo-de-marca/mrn-prepara-infraestrutura-de-energia-para-sustentar-operacoes-de-bauxita-no-para/', 'Setor', 'positivo'),
  ('SIMINERAL', 'refeito', 'Vale (VALE3) tem queda de 53% no lucro do 3T26; veja os resultados', 'https://euqueroinvestir.com/acoes/vale-vale3-lucro-cai-53-3t26-resultados', 'Setor', 'neutro'),
  ('SIMINERAL', 'refeito', 'Vale (VALE3) lucra US$ 1,25 bilhão no 3T26, tombo de 54%', 'https://investidor10.com.br/noticias/vale-vale3-lucra-us-1-25-bilhao-no-3t26-tombo-de-54-123604/', 'Setor', 'neutro')
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
  WHERE ref.cliente = 'SIMINERAL'
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
