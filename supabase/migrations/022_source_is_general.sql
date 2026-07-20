-- 022: marca fontes "generalistas" (firehose) como config no banco, em vez de
-- uma lista hard-coded no NewsPage. Essas fontes só aparecem na visão de
-- portfólio (sem cliente selecionado) quando batem nos termos de algum cliente;
-- feeds temáticos/especializados sempre passam. Idempotente.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS is_general BOOLEAN NOT NULL DEFAULT false;

UPDATE sources SET is_general = true WHERE name IN (
  'Carta Capital', 'Metrópoles', 'Poder360', 'Folha de S.Paulo', 'Brasil Journal',
  'Exame', 'G1', 'O Globo', 'Estadão', 'Agência Estado / Broadcast', 'Brasil 247',
  'Google News — Brasil (manchetes)'
);
