-- 011: ensure the articles table has every column the ingestion code writes.
-- The fetch upserts `publisher` (migration 007); if that column is missing in a
-- given database, EVERY upsert fails silently and no new articles are stored.
-- Idempotent re-assert fixes that. Safe to run anytime.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publisher TEXT;
