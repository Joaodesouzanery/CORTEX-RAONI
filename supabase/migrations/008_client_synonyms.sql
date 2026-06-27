-- 008: per-client synonym groups to broaden keyword matching without AI.
-- One group per line, terms separated by commas (e.g. "apagão, blecaute, desligamento").
-- All terms across all groups are added to the client's match set.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS synonyms TEXT;
