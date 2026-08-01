-- Phase 7E Block 14: Standard 2 runtime state.
-- These tables persist resolved installation state and runtime registrations.
-- They do not execute module code and do not mutate production data by default.

CREATE TABLE IF NOT EXISTS greenfield_module_resolved_dependencies (
  resolution_id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES greenfield_module_install_plans(plan_id) ON DELETE CASCADE,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('requires','optional','recommended','conflicts','replaces','provides')),
  target_module_id TEXT,
  provided_contract TEXT,
  requested_range TEXT NOT NULL DEFAULT '*',
  resolved_module_id TEXT,
  resolved_version TEXT,
  installed BOOLEAN NOT NULL DEFAULT FALSE,
  satisfied BOOLEAN NOT NULL DEFAULT FALSE,
  blocking BOOLEAN NOT NULL DEFAULT FALSE,
  degraded BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (target_module_id IS NOT NULL OR provided_contract IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS greenfield_module_resolved_dependencies_installation_idx
  ON greenfield_module_resolved_dependencies(installation_id, module_id, relation);
CREATE INDEX IF NOT EXISTS greenfield_module_resolved_dependencies_contract_idx
  ON greenfield_module_resolved_dependencies(provided_contract, resolved_module_id);

CREATE TABLE IF NOT EXISTS greenfield_module_permission_states (
  permission_state_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  permission TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('requested','granted','denied','revoked','unsupported','requires-platform','requires-reauthorisation')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  risk TEXT NOT NULL DEFAULT 'low' CHECK (risk IN ('low','medium','high','critical','restricted')),
  policy_mode TEXT NOT NULL DEFAULT 'observe' CHECK (policy_mode IN ('observe','warn','require-confirmation','block')),
  reason TEXT NOT NULL,
  granted_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, permission)
);
CREATE INDEX IF NOT EXISTS greenfield_module_permission_states_activation_idx
  ON greenfield_module_permission_states(installation_id, required, state);

CREATE TABLE IF NOT EXISTS greenfield_module_capability_registry (
  capability_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('host','module','connector','ai-provider','storage','service','api')),
  provider_module_id TEXT,
  provider_installation_id TEXT,
  state TEXT NOT NULL CHECK (state IN ('requested','granted','denied','revoked','unsupported','requires-platform','requires-reauthorisation')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  health_state TEXT NOT NULL DEFAULT 'healthy' CHECK (health_state IN ('healthy','degraded','unavailable','configuration-required','disabled','quarantined')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, capability, provider_kind)
);
CREATE INDEX IF NOT EXISTS greenfield_module_capability_registry_module_idx
  ON greenfield_module_capability_registry(module_id, state, health_state);

CREATE TABLE IF NOT EXISTS greenfield_module_service_registrations (
  service_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_kind TEXT NOT NULL,
  version TEXT NOT NULL,
  contract_ref TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array'),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  input_schema_ref TEXT,
  output_schema_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('registered','disabled','quarantined','removed')),
  health_state TEXT NOT NULL DEFAULT 'healthy' CHECK (health_state IN ('healthy','degraded','unavailable','configuration-required','disabled','quarantined')),
  timeout_ms INTEGER NOT NULL DEFAULT 5000 CHECK (timeout_ms BETWEEN 100 AND 30000),
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute BETWEEN 1 AND 10000),
  invocation_depth_limit INTEGER NOT NULL DEFAULT 4 CHECK (invocation_depth_limit BETWEEN 1 AND 16),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, service_id)
);
CREATE INDEX IF NOT EXISTS greenfield_module_service_registrations_lookup_idx
  ON greenfield_module_service_registrations(module_id, service_id, status);

CREATE TABLE IF NOT EXISTS greenfield_module_api_registrations (
  api_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  api_id TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('GET','POST','PATCH','PUT','DELETE')),
  path TEXT NOT NULL,
  input_schema_ref TEXT,
  output_schema_ref TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array'),
  side_effects TEXT NOT NULL CHECK (side_effects IN ('none','read','write','destructive','external','financial')),
  idempotent BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('registered','disabled','quarantined','removed')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, api_id),
  UNIQUE(installation_id, method, path)
);
CREATE INDEX IF NOT EXISTS greenfield_module_api_registrations_path_idx
  ON greenfield_module_api_registrations(module_id, method, path, status);

CREATE TABLE IF NOT EXISTS greenfield_module_hook_registrations (
  hook_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  hook_id TEXT NOT NULL,
  hook TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('before','after')),
  target TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  timeout_ms INTEGER NOT NULL DEFAULT 2000 CHECK (timeout_ms BETWEEN 100 AND 10000),
  failure_policy TEXT NOT NULL CHECK (failure_policy IN ('observe','warn','require-confirmation','block')),
  status TEXT NOT NULL CHECK (status IN ('registered','disabled','quarantined','removed')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, hook_id),
  UNIQUE(installation_id, phase, target, order_index)
);
CREATE INDEX IF NOT EXISTS greenfield_module_hook_registrations_target_idx
  ON greenfield_module_hook_registrations(module_id, phase, target, status);

CREATE TABLE IF NOT EXISTS greenfield_module_lifecycle_transactions (
  transaction_id TEXT PRIMARY KEY,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE SET NULL,
  module_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('install','enable','disable','update','uninstall','repair','quarantine','unquarantine')),
  status TEXT NOT NULL CHECK (status IN ('planned','running','completed','failed','rolled-back','cancelled')),
  idempotency_key TEXT,
  rollback_policy TEXT NOT NULL DEFAULT 'preserve-data',
  data_retention_choice TEXT CHECK (data_retention_choice IS NULL OR data_retention_choice IN ('keepData','exportThenDelete','deleteData')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_module_lifecycle_transactions_installation_idx
  ON greenfield_module_lifecycle_transactions(installation_id, action, status);

CREATE TABLE IF NOT EXISTS greenfield_module_lifecycle_stages (
  stage_id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES greenfield_module_lifecycle_transactions(transaction_id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  order_index INTEGER NOT NULL CHECK (order_index >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','skipped','rolled-back')),
  failure_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(transaction_id, order_index),
  UNIQUE(transaction_id, stage)
);

CREATE TABLE IF NOT EXISTS greenfield_module_storage_allocations (
  allocation_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  storage_kind TEXT NOT NULL CHECK (storage_kind IN ('records','settings','cache','temporary','object-storage','attachments','secrets','history')),
  scope TEXT NOT NULL CHECK (scope IN ('account','installation')),
  quota_bytes BIGINT CHECK (quota_bytes IS NULL OR quota_bytes >= 0),
  retention_policy TEXT NOT NULL DEFAULT 'retain',
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  export_supported BOOLEAN NOT NULL DEFAULT TRUE,
  deletion_supported BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL CHECK (status IN ('allocated','disabled','quarantined','released')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, storage_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_storage_allocations_scope_idx
  ON greenfield_module_storage_allocations(account_id, module_id, storage_kind, status);

CREATE TABLE IF NOT EXISTS greenfield_module_secret_refs (
  secret_ref TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  encrypted_value BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  auth_tag BYTEA NOT NULL,
  key_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','rotated','revoked','deleted')),
  redacted_descriptor JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_descriptor) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, secret_key)
);

CREATE TABLE IF NOT EXISTS greenfield_module_job_registrations (
  job_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  job_key TEXT NOT NULL,
  job_kind TEXT NOT NULL CHECK (job_kind IN ('one-off','delayed','recurring','cleanup','repair','reindex','health-check','sync','migration','queue','cron','realtime')),
  function_id TEXT,
  schedule TEXT,
  retry_policy JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(retry_policy) = 'object'),
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('registered','paused','disabled','quarantined','removed')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, job_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_job_registrations_pause_idx
  ON greenfield_module_job_registrations(installation_id, paused, status);

CREATE TABLE IF NOT EXISTS greenfield_module_ui_contribution_registrations (
  ui_registration_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  contribution_key TEXT NOT NULL,
  surface TEXT NOT NULL CHECK (surface IN ('board','profile-tabs','settings','composer-tools','context-menu','search-provider','module-route','widget')),
  status TEXT NOT NULL CHECK (status IN ('registered','disabled','quarantined','removed')),
  declaration JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(declaration) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, contribution_key, surface)
);
CREATE INDEX IF NOT EXISTS greenfield_module_ui_contribution_surface_idx
  ON greenfield_module_ui_contribution_registrations(account_id, surface, status);

CREATE TABLE IF NOT EXISTS greenfield_module_service_invocations (
  invocation_id TEXT PRIMARY KEY,
  caller_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  provider_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  service_registration_id TEXT NOT NULL REFERENCES greenfield_module_service_registrations(service_registration_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  caller_module_id TEXT NOT NULL,
  provider_module_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  invocation_depth INTEGER NOT NULL DEFAULT 1 CHECK (invocation_depth BETWEEN 1 AND 16),
  status TEXT NOT NULL CHECK (status IN ('accepted','completed','failed','denied','timed-out')),
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  policy_code TEXT NOT NULL,
  failure_code TEXT,
  latency_ms INTEGER,
  redacted_input JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_input) = 'object'),
  redacted_output JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_output) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(caller_installation_id, service_registration_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS greenfield_module_service_invocations_rate_idx
  ON greenfield_module_service_invocations(service_registration_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','027') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
