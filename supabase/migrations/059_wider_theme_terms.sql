-- 059: termos mais largos nos temas do mês, agora que o TEMA também marca a
-- matéria na coleta (src/lib/classification.ts → evaluateThemeOnly, 14/11/2026).
--
-- Por quê: os temas da 039 usavam frases exatas ("baterias no sistema
-- elétrico", "leilão de baterias") e quase nada casava; o Painel ficava vazio.
-- Os termos novos saíram das manchetes do clipping da ONS de outubro
-- (docs/evidencias/2026-10/gabarito-ons) e dos relatórios refeitos. Continuam
-- FRASES com contexto do setor: termo solto ("baterias", "data center") num
-- feed geral marcaria celular e e-commerce. O tema casa só no título/resumo,
-- por token, e marca como `revisao` (nunca base qualificada sem curadoria).
--
-- Idempotente: só acrescenta termos que faltam; não religa tema desligado.

CREATE TEMP TABLE IF NOT EXISTS seed_059 (client_key TEXT, title TEXT, terms TEXT);
TRUNCATE seed_059;
INSERT INTO seed_059 VALUES
  ('ONS', 'Reserva de capacidade e necessidade de potência', '["leilão de reserva de capacidade","potência no horário de pico","garantir potência","oferta de potência"]'),
  ('ONS', 'LRCAP e leilões de potência', '["LRCap","leilão de capacidade de 2026","leilão de potência"]'),
  ('ONS', 'Baterias e armazenamento de energia', '["armazenamento em baterias","sistemas de armazenamento","baterias de grande porte","leilão de armazenamento","BESS","baterias no SIN"]'),
  ('ONS', 'Baterias para reduzir curtailment', '["baterias podem reduzir","baterias reduzem cortes"]'),
  ('ONS', 'Excesso de geração renovável e curtailment', '["cortes de geração","corte de geração","constrained-off","geração frustrada","cortes de energia renovável"]'),
  ('ONS', 'Grandes cargas e data centers', '["data centers na rede","conexão de grandes consumidores","grandes consumidores","Rede Básica","Redata"]'),
  ('ONS', 'Despacho térmico, hidrologia e El Niño', '["térmicas acionadas","geração termelétrica","reservatórios das hidrelétricas","afluências","carga de energia"]'),
  ('ONS', 'Segurança e confiabilidade da operação do SIN', '["queda de torres","torres de transmissão","linhas de transmissão","operação especial"]'),
  ('CCEE', 'Abertura do mercado livre e baixa tensão', '["mercado livre de energia","migração para o mercado livre","consumidores livres","abertura do mercado"]'),
  ('CCEE', 'Gás natural, termelétricas e abertura do mercado de gás', '["leilão de gás","gás da União","PPSA"]'),
  ('CCEE', 'Formação de preços, PLD e transparência dos modelos', '["COBRE","preço de liquidação","preço da energia no mercado de curto prazo"]'),
  ('PRIO', 'Brent elevado e captura de valor pelo produtor', '["preço do petróleo","petróleo sobe","barril do petróleo"]'),
  ('PRIO', 'Produção da PRIO e trajetória para 200 mil bpd', '["produção da Prio","Prio produz","vendas de petróleo da Prio"]'),
  ('SIMINERAL', 'Competitividade na corrida global por minerais críticos', '["minerais críticos","terras raras","minerais estratégicos"]'),
  ('SINDINFOR', 'Inteligência artificial e regulação de dados', '["inteligência artificial","marco da IA","PL da IA"]'),
  ('DAQ', 'Licenciamento ambiental, dragagem e segurança jurídica', '["dragagem","obras de dragagem","calado"]'),
  ('DAQ', 'Hidrovia do Madeira', '["rio Madeira","Porto Velho"]');

UPDATE client_report_topic_templates t
SET inclusion_terms = (
      SELECT jsonb_agg(DISTINCT term)
      FROM (
        SELECT jsonb_array_elements_text(t.inclusion_terms) AS term
        UNION
        SELECT jsonb_array_elements_text(seed.terms::JSONB)
      ) merged
    ),
    updated_at = NOW()
FROM seed_059 seed
JOIN clients client ON client.name = seed.client_key OR client.name LIKE seed.client_key || ' %'
WHERE t.client_id = client.id
  AND t.title = seed.title
  AND NOT (t.inclusion_terms @> seed.terms::JSONB);

DROP TABLE seed_059;

-- Conferência: termos por tema da ONS.
-- SELECT title, jsonb_array_length(inclusion_terms) FROM client_report_topic_templates t
--   JOIN clients c ON c.id = t.client_id WHERE c.name = 'ONS' ORDER BY position;

NOTIFY pgrst, 'reload schema';
