-- 044: agenda regulatoria da ANTAQ, a partir do Boletim Mensal oficial de setembro/2026.
-- O painel Aquarela bloqueia acesso automatizado; o PDF do boletim e publico.
-- Os temas 1.5 e 3.6 foram excluidos pela propria agencia (Acordao 677-2025).
-- Prazo so nos dois avisos de tomada de subsidios que o boletim traz.
-- checked_at e a data do boletim: nao finge conferencia mais recente.

INSERT INTO regulatory_agenda_items
  (agency, title, item_type, phase, deadline, official_url, client_names, checked_at)
SELECT 'ANTAQ', seed.title, 'Tema da Agenda 2025-2028', seed.phase, seed.deadline,
       'https://www.gov.br/antaq/pt-br/acesso-a-informacao/acoes-e-programas/governanca-regulatoria/agenda-regulatoria-ar/21-boletim-ar-2025-2028-setembro26.pdf',
       ARRAY['ANTAQ', 'DAQ/DNIT'], '2026-09-30'::TIMESTAMPTZ
FROM (VALUES
  ('1.1 Revisão e simplificação do estoque regulatório da navegação interior', '11. Concluído', NULL::DATE),
  ('1.2 Penalidades nas normas de navegação interior', '1. Não iniciado', NULL::DATE),
  ('1.3 Operações de transbordo de granel sólido (barge to ship)', '3. Em tomada de subsídios', '2026-10-15'::DATE),
  ('1.4 Critérios de serviço adequado no serviço de transporte público', '2. Em análise preliminar', NULL::DATE),
  ('2.1 Afretamento por tempo na navegação marítima', '5. Em deliberação para participação social', NULL::DATE),
  ('2.2 Consulta ao mercado da disponibilidade de embarcação brasileira', '5. Em deliberação para participação social', NULL::DATE),
  ('2.3 Transferência de combustível entre embarcações (bunkering)', '3. Em tomada de subsídios', NULL::DATE),
  ('2.4 Concessão de outorgas na navegação', '1. Não iniciado', NULL::DATE),
  ('2.5 Agente intermediário na sobre-estadia de contêineres', '1. Não iniciado', NULL::DATE),
  ('2.6 Sobre-estadia de contêiner (Resolução 62/2021)', '3. Em tomada de subsídios', '2026-10-20'::DATE),
  ('2.7 Contabilização de TPB para afretamento no REB', '2. Em análise preliminar', NULL::DATE),
  ('2.8 Serviço concedido de infraestrutura aquaviária (hidrovias e canais de acesso)', '2. Em análise preliminar', NULL::DATE),
  ('3.1 Revisão da Norma de Registros (Resolução 13/2016)', '4. Em elaboração da proposta normativa', NULL::DATE),
  ('3.2 Atualização da Norma de Fiscalização Portuária (Resolução 75/2022)', '9. Em análise técnica final', NULL::DATE),
  ('3.3 Revisão da Norma de Outorgas de Instalações Portuárias (Resolução 71/2022)', '4. Em elaboração da proposta normativa', NULL::DATE),
  ('3.4 Contratos de passagem nos portos organizados', '11. Concluído', NULL::DATE),
  ('3.5 Pátios de triagem de veículos', '1. Não iniciado', NULL::DATE),
  ('3.7 Recomposição cautelar do equilíbrio de contratos de arrendamento', '1. Não iniciado', NULL::DATE),
  ('3.8 Transmutação de contratos de passagem em TUP', '1. Não iniciado', NULL::DATE),
  ('3.9 Inventário de emissões de gases de efeito estufa no sistema portuário', '2. Em análise preliminar', NULL::DATE),
  ('3.10 Serviços dos terminais de contêineres em trânsito aduaneiro', '2. Em análise preliminar', NULL::DATE)
) AS seed(title, phase, deadline)
ON CONFLICT (agency, official_url, title) DO UPDATE SET
  phase = EXCLUDED.phase, deadline = EXCLUDED.deadline,
  checked_at = EXCLUDED.checked_at, updated_at = NOW();
