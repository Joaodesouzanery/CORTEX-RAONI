-- 021: saúde de cada fonte na coleta. Cada fetch grava quantos itens a fonte
-- retornou e quando — assim um feed morto (retorna ~0) aparece na tela /fontes
-- em vez de degradar a cobertura de todos os clientes em silêncio.
-- Idempotente.
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetch_count INTEGER;
ALTER TABLE sources ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ;
