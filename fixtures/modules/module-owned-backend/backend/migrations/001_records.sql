CREATE TABLE IF NOT EXISTS reference_records (
  record_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (installation_id, record_id)
);

CREATE INDEX IF NOT EXISTS reference_records_scope_idx
  ON reference_records(account_id, installation_id, created_at, record_id);
