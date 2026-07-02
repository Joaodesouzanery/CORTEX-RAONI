-- 013: map each client to its thematic Google News feed(s). An article is
-- relevant to a client if it matches the client's keywords/synonyms OR comes from
-- one of these feeds (the feed is the client's curated stream). Idempotent.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS feed_names TEXT[];

UPDATE clients SET feed_names = ARRAY['Google News — ONS/Setor Elétrico'] WHERE name = 'ONS';
UPDATE clients SET feed_names = ARRAY['Google News — CCEE/Mercado de Energia'] WHERE name = 'CCEE';
UPDATE clients SET feed_names = ARRAY['Google News — Gás Natural'] WHERE name = 'Gás Natural';
UPDATE clients SET feed_names = ARRAY['Google News — Mineração'] WHERE name = 'Mineração';
UPDATE clients SET feed_names = ARRAY['Google News — Aquaviário/Hidrovias'] WHERE name = 'DNIT Aquaviária';
UPDATE clients SET feed_names = ARRAY['Google News — Rodovias/DNIT'] WHERE name = 'DNIT Rodoviária';
UPDATE clients SET feed_names = ARRAY['Google News — Software/TI'] WHERE name = 'SindInfor';
