-- 046: no teste de outubro/2026, 173 de 291 materias do SIMINERAL vieram
-- confirmadas e so 89 mencionavam o Para: regras genericas somavam ate o corte
-- de 5. Citacao direta, Para/Carajas, Amazonia e cavidades seguem confirmando.
-- Pesos so mudam a classificacao; nenhuma materia e apagada.
UPDATE client_relevance_rules rule
SET weight = seed.weight, version = rule.version + 1, updated_at = NOW()
FROM clients client, (VALUES
  ('mineração nacional', 1),
  ('mineração e sustentabilidade', 2),
  ('minerais críticos com impacto brasileiro', 2),
  ('tema: Terras raras e minerais estratégicos', 1),
  ('tema: Competitividade na corrida global por minerais críticos', 1)
) AS seed(label, weight)
WHERE client.id = rule.client_id AND client.name = 'SIMINERAL'
  AND rule.label = seed.label AND rule.weight <> seed.weight;

-- Sem contador, link que nunca resolve ficaria no topo da fila para sempre.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS resolve_attempts INTEGER NOT NULL DEFAULT 0;
