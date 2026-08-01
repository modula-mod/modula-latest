-- Phase 7E Block 10: User-controlled AI product actions.
-- Product action executions persist metadata and short-lived result state only.

ALTER TABLE greenfield_module_record_versions
  DROP CONSTRAINT IF EXISTS greenfield_module_record_versions_change_source_check;

ALTER TABLE greenfield_module_record_versions
  ADD CONSTRAINT greenfield_module_record_versions_change_source_check
  CHECK (change_source IN ('update','restore','import','delete','ai-assisted'));

ALTER TABLE greenfield_module_record_versions
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object');

CREATE TABLE IF NOT EXISTS ai_product_action_executions (
  product_execution_id TEXT PRIMARY KEY,
  ai_execution_id TEXT UNIQUE REFERENCES ai_executions(execution_id) ON DELETE SET NULL,
  request_id TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  action_id TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  record_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  application_mode TEXT NOT NULL CHECK (application_mode IN ('preview-only','replace-selection','replace-document','insert','metadata-suggestion')),
  status TEXT NOT NULL CHECK (status IN ('queued','running','completed','failed','cancelled','expired')),
  application_status TEXT NOT NULL CHECK (application_status IN ('not-applicable','pending','applied','rejected','expired')),
  stream_path TEXT,
  context_summary JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(context_summary) = 'object'),
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_metadata) = 'object'),
  usage_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(usage_metadata) = 'object'),
  failure_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_product_action_executions_account_idx
  ON ai_product_action_executions(account_id, module_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_product_action_executions_record_idx
  ON ai_product_action_executions(account_id, module_id, record_id, source_revision);

CREATE TABLE IF NOT EXISTS ai_product_action_results (
  result_id TEXT PRIMARY KEY,
  product_execution_id TEXT NOT NULL UNIQUE REFERENCES ai_product_action_executions(product_execution_id) ON DELETE CASCADE,
  result_hash TEXT NOT NULL,
  result_data JSONB NOT NULL CHECK (jsonb_typeof(result_data) = 'object'),
  schema_ref TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available','applied','rejected','expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_product_action_results_expiry_idx
  ON ai_product_action_results(status, expires_at);

CREATE TABLE IF NOT EXISTS ai_product_action_applications (
  application_id TEXT PRIMARY KEY,
  product_execution_id TEXT NOT NULL UNIQUE REFERENCES ai_product_action_executions(product_execution_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  action_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL CHECK (source_revision > 0),
  resulting_revision INTEGER NOT NULL CHECK (resulting_revision > 0),
  result_hash TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, idempotency_key)
);

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','026')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
