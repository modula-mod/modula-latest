-- Phase 7M-B10: real account ratings for Marketplace module products.
CREATE TABLE IF NOT EXISTS greenfield_module_ratings (
  rating_id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(module_id, account_id)
);

CREATE INDEX IF NOT EXISTS greenfield_module_ratings_module_idx
  ON greenfield_module_ratings(module_id, updated_at DESC);

INSERT INTO schema_metadata (key,value)
VALUES ('schema_version','038')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
