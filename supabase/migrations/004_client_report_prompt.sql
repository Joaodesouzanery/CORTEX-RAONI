-- 004: per-client report direction + identity, for multi-client reports.
-- Idempotent (safe to re-run). Depends on the `clients` table from 003.

-- Persistent directive injected into the report's system prompt (focus, angles).
ALTER TABLE clients ADD COLUMN IF NOT EXISTS report_prompt TEXT;

-- Client sector/segment, used to generalize the (formerly ONS-hardcoded) prompt.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS sector TEXT;

-- Contracted consultancy; falls back to CRTIVE in the app when null.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contratante TEXT;
