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
  ('DAQ', 'refeito', 'Seca reduz profundidade do Rio Tapajós e acende alerta para transporte de cargas', 'https://pimamazonia.balponte.com.br/seca-rio-tapajos-alerta-transporte-cargas/', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'NAVEGAÇÃO: DNIT avança com dragagem no Rio Madeira e projeta conclusão em Manicoré', 'https://www.rondoniaovivo.com/noticia/geral/2026/10/06/navegacao-dnit-avanca-com-dragagem-no-rio-madeira-e-projeta-conclusao-em-manicore.html', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'DNIT firma acordo para estudos e eventual dragagem de 590 km da hidrovia do Rio Paraguai', 'https://diarionline.com.br/index.php?s=noticia&id=159433', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'Dnit abre caminho para associação privada dragar 590 km do Rio Paraguai em MS', 'https://acritica.net/economia/dnit-acordo-abani-dragagem-rio-paraguai-590-km-ms/', 'Cliente', 'neutro'),
  ('DAQ', 'refeito', 'Dnit abre caminho para dragagem de pontos críticos', 'https://www.lugares.eco.br/noticias/2026/10/08/dnit-abre-caminho-para-dragagem-de-pontos-criticos.html', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'Hidrovia do São Francisco: CODEBA debate viabilidade para transporte de até 5 milhões de toneladas de cargas', 'https://jornalgrandebahia.com.br/2026/10/hidrovia-do-sao-francisco-codeba-debate-viabilidade-para-transporte-de-ate-5-milhoes-de-toneladas-de-cargas/', 'Setor', 'positivo'),
  ('DAQ', 'refeito', 'Projeto de reativação da Hidrovia do São Francisco é destacado durante encontro com o vice-presidente da República', 'https://anoticiadovale.com/2026/10/16/projeto-de-reativacao-da-hidrovia-do-sao-francisco-e-destacado-durante-encontro-com-o-vice-presidente-da-republica/', 'Setor', 'positivo'),
  ('DAQ', 'refeito', 'Seca deixa hidrovias da Amazônia e do Pantanal em situação de alerta', 'https://c-level.folha.uol.com.br/infraestrutura/2026/10/seca-deixa-hidrovias-da-amazonia-e-do-pantanal-em-situacao-de-alerta.shtml', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'DNIT realiza inspeção técnica na travessia entre Manaus e Careiro da Várzea', 'https://www.gov.br/dnit/pt-br/assuntos/noticias/dnit-realiza-inspecao-tecnica-na-travessia-entre-manaus-e-careiro-da-varzea', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'Antaq avalia condições das travessias no Amazonas durante estiagem', 'https://boca.com.br/brasil/antaq-avalia-condicoes-das-travessias-no-amazonas', 'Cliente', 'neutro'),
  ('DAQ', 'refeito', 'Antaq estima recuperação de navegabilidade na região Norte a partir de novembro', 'https://www.oliberal.com/economia/antaq-estima-recuperacao-de-navegabilidade-na-regiao-norte-a-partir-de-novembro-1.1185435', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'Seca coloca hidrovias do Madeira, Tapajós e Paraguai em alerta', 'https://portalbenews.com.br/seca-coloca-hidrovias-do-madeira-tapajos-e-paraguai-em-alerta-para-transporte/', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'Motoristas da BR-319 que atravessam de balsa entre Manaus e o Careiro da Várzea terão dragagem a partir da próxima semana (…)', 'https://navalportoestaleiro.com/travessia-manaus-careiro-da-varzea-dragagem-banco-de-areia-rio-negro/', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'NAVEGAÇÃO EM FOCO – ANTAQ debate concessão da Hidrovia Verde no Amapá.', 'https://portaldanavegacao.com/2026/10/22/navegacao-em-foco-antaq-debate-concessao-da-hidrovia-verde-no-amapa/', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'DNIT fará dragagem na travessia entre Manaus e Careiro da Várzea', 'https://www.acritica.com/geral/dnit-fara-dragagem-na-travessia-entre-manaus-e-careiro-da-varzea/', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'DNIT fará dragagem na travessia entre Manaus e Careiro', 'https://www.portaldocaubi.com.br/dnit-fara-dragagem-na-travessia-entre-manaus-e-careiro/', 'Cliente', 'positivo'),
  ('DAQ', 'refeito', 'Brasil usa menos da metade das hidrovias previstas para transporte de cargas, diz CNT', 'https://www.otempo.com.br/economia/2026/10/23/brasil-usa-menos-da-metade-das-hidrovias-previstas-para-transporte-de-cargas-diz-cnt', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'Brasil utiliza apenas 49% da malha hidroviária prevista', 'https://sinaval.org.br/2026/10/brasil-utiliza-apenas-49-da-malha-hidroviaria-prevista/', 'Setor', 'neutro'),
  ('DAQ', 'refeito', 'Hidrovia do Paraguai cresce 195% enquanto Paraná-Tietê perde 31% no transporte de cargas', 'https://clickpetroleoegas.com.br/hidrovia-do-paraguai-cresce-195-enquanto-parana-tiete-perde-31-no-transporte-de-cargas-ctl01', 'Cliente', 'neutro'),
  ('DAQ', 'refeito', 'DNIT faz dragagem sem licença ambiental e recua após pressão de ribeirinhos', 'https://www.acritica.com/amazonia/dnit-faz-dragagem-sem-licenca-ambiental-e-recua-apos-pressao-de-ribeirinhos/', 'Cliente', 'negativo')
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
  WHERE ref.cliente = 'DAQ'
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
