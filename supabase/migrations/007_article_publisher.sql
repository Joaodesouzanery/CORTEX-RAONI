-- 007: store the real outlet per article. Google News feeds expose the outlet in
-- <source> (the feed-level source name is just "Google News — <tema>"), so we keep
-- the publisher to cite the correct veículo in reports and show it in the UI.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS publisher TEXT;
