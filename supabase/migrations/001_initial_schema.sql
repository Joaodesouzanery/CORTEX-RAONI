CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE sources (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       TEXT NOT NULL,
  url        TEXT NOT NULL UNIQUE,
  type       TEXT NOT NULL CHECK (type IN ('rss', 'scrape')),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE articles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id    UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  url          TEXT NOT NULL UNIQUE,
  image_url    TEXT,
  excerpt      TEXT,
  content      TEXT,
  published_at TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX articles_source_id_idx ON articles(source_id);
CREATE INDEX articles_published_at_idx ON articles(published_at DESC);

CREATE TABLE reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt      TEXT NOT NULL,
  article_ids UUID[] NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
