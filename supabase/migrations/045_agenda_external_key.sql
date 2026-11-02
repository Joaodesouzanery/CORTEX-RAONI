-- 045: identidade estavel do tema da agenda. O link do boletim muda todo mes, e
-- agency+url+title criaria um tema duplicado a cada edicao.
ALTER TABLE regulatory_agenda_items ADD COLUMN IF NOT EXISTS external_key TEXT;
ALTER TABLE regulatory_agenda_items ADD COLUMN IF NOT EXISTS source_label TEXT;

UPDATE regulatory_agenda_items
SET external_key = split_part(title, ' ', 1)
WHERE agency = 'ANTAQ' AND external_key IS NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'regulatory_agenda_items_agency_key') THEN
    ALTER TABLE regulatory_agenda_items
      ADD CONSTRAINT regulatory_agenda_items_agency_key UNIQUE (agency, external_key);
  END IF;
END $$;
