-- 003: clients table, reports.client_id (FK), and the public `logos` storage bucket.
-- Idempotent on purpose: safe to run whether or not these objects were already
-- created manually in the Supabase dashboard. Aligns the versioned schema with
-- what the application code expects.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients: each client carries context + keywords (used to filter articles and
-- to enrich the report prompt) and an optional logo.
CREATE TABLE IF NOT EXISTS clients (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL UNIQUE,
  context    TEXT,
  keywords   TEXT[],
  logo_url   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Associate a report with a client (nullable; reports can be client-agnostic).
ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_client_id_fkey'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS reports_client_id_idx ON reports(client_id);

-- Public storage bucket for client logos. The upload route serves logos via
-- getPublicUrl(), so the bucket must be public-readable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;
