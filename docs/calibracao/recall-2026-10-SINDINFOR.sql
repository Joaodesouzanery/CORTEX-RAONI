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
  ('SINDINFOR', 'refeito', 'Assespro-MG lança livro sobre os 50 anos do setor de tecnologia em Minas', 'https://diariodocomercio.com.br/negocios/assespro-mg-historia-ti-estado/', 'Cliente', 'positivo'),
  ('SINDINFOR', 'refeito', 'Minas oferece até R$ 2 milhões por projeto para empresas criarem soluções para o setor público', 'https://diariodocomercio.com.br/negocios/mg-oferece-r-2-mi-projeto-solucoes-setor-publico/', 'Cliente', 'positivo'),
  ('SINDINFOR', 'refeito', 'Fiemg Lab conecta startups à indústria e impulsiona negócios', 'https://diariodocomercio.com.br/video/fiemg-lab-conecta-startups-a-industria-e-impulsiona-negocios/', 'Cliente', 'positivo'),
  ('SINDINFOR', 'refeito', 'LinkedIn revela as 10 startups em destaque em Belo Horizonte em 2026; veja quais são', 'https://diariodocomercio.com.br/negocios/top-startups-belo-horizonte-linkedin/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Startup mineira Oppem projeta faturamento de R$ 11 milhões e prepara expansão internacional', 'https://diariodocomercio.com.br/negocios/oppem-expansao-internacional/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Empresas no nível digital iniciante caem de 17% para 2%', 'https://diariodocomercio.com.br/negocios/empresas-no-nivel-digital-iniciante/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Philips investe R$ 15 milhões e amplia centro de pesquisa em Varginha', 'https://diariodocomercio.com.br/negocios/philips-ampliacao-empresa-varginha/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'No dia do profissional de TI, saiba quais são os cargos mais bem pagos na área', 'https://convergenciadigital.com.br/carreira/no-dia-do-profissional-de-ti-saiba-quais-sao-os-cargos-mais-bem-pagos-na-area/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Govtech nacional abre inscrições para trainee com foco no uso de IA e com salário de R$ 7 mil', 'https://convergenciadigital.com.br/carreira/govtech-nacional-abre-inscricoes-para-trainee-com-foco-no-uso-de-ia-e-com-salario-de-r-7-mil/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Bradesco, Santander e DXC oferecem 25 mil bolsas gratuitas em bootcamps de IA', 'https://convergenciadigital.com.br/carreira/bradesco-santander-e-dxc-oferecem-25-mil-bolsas-gratuitas-em-bootcamps-de-ia/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Bradesco e DIO distribuem 5 mil bolsas gratuitas para ensinar a fazer agentes IA', 'https://convergenciadigital.com.br/carreira/bradesco-e-dio-distribuem-5-mil-bolsas-gratuitas-para-ensinar-a-fazer-agentes-ia/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Governo quer contar com 1300 analistas de TI para acelerar transformação digital', 'https://convergenciadigital.com.br/governo/governo-quer-contar-com-1300-analistas-de-ti-para-acelerar-transformacao-digital/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Reforma tributária: TCU propõe alíquota de 11,3% para CBS em 2027', 'https://convergenciadigital.com.br/governo/reforma-tributaria-tcu-propoe-aliquota-de-113-para-cbs-em-2027/', 'Setor', 'neutro'),
  ('SINDINFOR', 'refeito', 'Reforma Tributária: Frente Parlamentar pede ao Senado que rejeite a taxa de 11,3% para o CBS', 'https://convergenciadigital.com.br/governo/reforma-tributaria-frente-parlamentar-pede-ao-senado-que-rejeite-a-taxa-de-113-para-o-cbs/', 'Setor', 'negativo'),
  ('SINDINFOR', 'refeito', 'Abandonar o split payment alivia o caixa de quem vende, mas retarda o crédito de quem compra', 'https://convergenciadigital.com.br/opiniao/abandonar-o-split-payment-alivia-o-caixa-de-quem-vende-mas-retarda-o-credito-de-quem-compra/', 'Setor', NULL),
  ('SINDINFOR', 'refeito', 'IA pela IA não traz retorno e gera zero valor à empresa', 'https://convergenciadigital.com.br/mercado/ia-pela-ia-nao-traz-retorno-e-gera-zero-valor-a-empresa/', 'Setor', NULL),
  ('SINDINFOR', 'refeito', 'Uso de inteligência artificial nas empresas brasileiras cresce 183% em 2026', 'https://ohoje.com/2026/10/08/uso-de-inteligencia-artificial-nas-empresas-brasileiras-cresce-183-em-2026/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Pesquisa revela baixo nível de maturidade no uso de IA no Brasil', 'https://teletime.com.br/30/10/2026/pesquisa-raio-x-ia-brasil/', 'Setor', 'negativo'),
  ('SINDINFOR', 'refeito', 'Brasil investe apenas 6,4% do orçamento de TI em cibersegurança', 'https://convergenciadigital.com.br/mercado/brasil-investe-apenas-64-do-orcamento-de-ti-em-ciberseguranca/', 'Setor', 'negativo'),
  ('SINDINFOR', 'refeito', 'Sites de governos e empresas saem do ar por brecha na linguagem PHP', 'https://convergenciadigital.com.br/mercado/sites-de-governos-e-empresas-saem-do-ar-por-brecha-na-linguagem-php/', 'Setor', 'negativo'),
  ('SINDINFOR', 'refeito', 'Paracatu pode receber data center de R$ 35 bilhões ligado à inteligência artificial', 'https://diariodocomercio.com.br/economia/paracatu-data-center-atlas-energy/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Parceiros do Futuro: Minas mira avanço da indústria tecnológica e da inovação até 2040', 'https://diariodocomercio.com.br/parceiros-do-futuro/forum-lideres-metas-hub-global/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Startup desenvolve IA para monitorar pacientes do SUS e negocia expansão em Minas Gerais', 'https://diariodocomercio.com.br/negocios/startup-ia-monitoramento-pacientes-sus/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Brasscom defende regulamentação imediata do Redata sem a parte das fontes de energia de baixa emissão', 'https://convergenciadigital.com.br/governo/brasscom-defende-regulamentacao-imediata-do-redata-sem-a-parte-das-fontes-de-energia-de-baixa-emissao/', 'Setor', 'neutro'),
  ('SINDINFOR', 'refeito', 'Ministro das Comunicações: governo faz ajustes e prevê regulamentação do Redata ainda este ano', 'https://convergenciadigital.com.br/inovacao/ministro-das-comunicacoes-governo-faz-ajustes-e-preve-regulamentacao-do-redata-ainda-este-ano/', 'Setor', 'neutro'),
  ('SINDINFOR', 'refeito', 'Nove frentes parlamentares e 32 entidades cobram de Lula regulamentação imediata do Redata', 'https://tiinside.com.br/16/10/2026/nove-frentes-parlamentares-e-32-entidades-cobram-de-lula-regulamentacao-imediata-do-redata/', 'Setor', NULL),
  ('SINDINFOR', 'refeito', 'Reeleito, Lula quer IA brasileira; promete incentivar data centers e acelerar regulação das big techs', 'https://convergenciadigital.com.br/governo/reeleito-lula-quer-ia-brasileira-promete-incentivar-data-centers-e-acelerar-regulacao-das-big-techs/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'Lei do Bem: 4598 empresas foram beneficiadas e renúncia fiscal ficou em R$ 15,8 bilhões em 2025', 'https://convergenciadigital.com.br/governo/lei-do-bem-4598-empresas-foram-beneficiadas-e-renuncia-fiscal-ficou-em-r-158-bilhoes-em-2025/', 'Setor', 'neutro'),
  ('SINDINFOR', 'refeito', 'Mercado brasileiro de cibersegurança deve movimentar R$ 127 bi até 2029, aponta estudo da Brasscom', 'https://tiinside.com.br/16/10/2026/mercado-brasileiro-de-ciberseguranca-deve-movimentar-r-127-bi-ate-2029-aponta-estudo-da-brasscom/', 'Setor', 'positivo'),
  ('SINDINFOR', 'refeito', 'ANPD impõe sanções à Prefeitura de Feira de Santana (BA) pelo vazamento de dados médicos de 1.200 pessoas', 'https://convergenciadigital.com.br/governo/anpd-impoe-sancoes-a-prefeitura-de-feira-de-santana-ba-pelo-vazamento-de-dados-medicos-de-1-200-pessoas/', 'Setor', 'negativo')
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
  WHERE ref.cliente = 'SINDINFOR'
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
