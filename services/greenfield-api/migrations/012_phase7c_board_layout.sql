-- Phase 7C: account-backed Board layout persistence.

CREATE TABLE IF NOT EXISTS greenfield_board_layouts (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  board_widget_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','012') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
