-- MODULE-PLATFORM-02B: governed module functions, host negotiation and
-- source-derived inter-module action requests.

ALTER TABLE greenfield_module_contributions
  DROP CONSTRAINT IF EXISTS greenfield_module_contributions_contribution_type_check;
ALTER TABLE greenfield_module_contributions
  ADD CONSTRAINT greenfield_module_contributions_contribution_type_check
  CHECK (contribution_type IN ('route','profileTab','boardSurface','setting','schema','tool','function','interModuleAction','widget','plugin','connector','job','event'));

CREATE TABLE greenfield_function_implementations (
  implementation_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  function_id TEXT NOT NULL,
  function_version TEXT NOT NULL,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('server','remote')),
  handler_key TEXT,
  endpoint_url TEXT,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  network_allowed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(release_id, function_id, function_version, execution_mode),
  CHECK ((execution_mode = 'server' AND handler_key IS NOT NULL AND endpoint_url IS NULL)
      OR (execution_mode = 'remote' AND endpoint_url IS NOT NULL AND handler_key IS NULL))
);

CREATE TABLE greenfield_function_invocations (
  invocation_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  function_version TEXT NOT NULL,
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('host','server','remote','community')),
  request_identity TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created','dispatched','completed','failed','cancelled','timed_out','host_unavailable','module_unloaded')),
  success BOOLEAN,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(account_id, installation_id, function_id, function_version, request_identity)
);
CREATE INDEX greenfield_function_invocations_ledger_idx
  ON greenfield_function_invocations(account_id, installation_id, created_at DESC);

CREATE TABLE greenfield_function_mutations (
  mutation_row_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  function_version TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed')),
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(account_id, installation_id, function_id, function_version, mutation_id)
);

CREATE TABLE greenfield_host_function_executors (
  executor_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  capabilities JSONB NOT NULL CHECK (jsonb_typeof(capabilities) = 'array'),
  status TEXT NOT NULL CHECK (status IN ('available','unavailable')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_host_function_executors_available_idx
  ON greenfield_host_function_executors(account_id, installation_id, release_id, status, expires_at);

CREATE TABLE greenfield_host_function_requests (
  request_id TEXT PRIMARY KEY,
  invocation_id TEXT NOT NULL REFERENCES greenfield_function_invocations(invocation_id) ON DELETE CASCADE,
  executor_id TEXT REFERENCES greenfield_host_function_executors(executor_id) ON DELETE SET NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  function_id TEXT NOT NULL,
  function_version TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('created','dispatched','completed','cancelled','timed_out','host_unavailable','module_unloaded')),
  input_payload JSONB NOT NULL,
  output_payload JSONB,
  output_hash TEXT,
  deadline_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX greenfield_host_function_requests_dispatch_idx
  ON greenfield_host_function_requests(executor_id, state, deadline_at, created_at);

CREATE TABLE greenfield_module_runtime_credentials (
  credential_id TEXT PRIMARY KEY,
  credential_hash TEXT NOT NULL UNIQUE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_module_runtime_credentials_lookup_idx
  ON greenfield_module_runtime_credentials(credential_hash, expires_at) WHERE revoked_at IS NULL;

CREATE TABLE greenfield_inter_module_action_requests (
  request_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  source_installation_id TEXT NOT NULL,
  source_module_id TEXT NOT NULL,
  target_installation_id TEXT NOT NULL,
  target_module_id TEXT NOT NULL,
  target_release_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  action_version TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','completed','failed')),
  result JSONB,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(account_id, source_installation_id, target_installation_id, action_id, action_version, mutation_id)
);
CREATE INDEX greenfield_inter_module_action_requests_ledger_idx
  ON greenfield_inter_module_action_requests(account_id, source_installation_id, created_at DESC);

REVOKE ALL ON greenfield_function_implementations,
  greenfield_function_invocations,
  greenfield_function_mutations,
  greenfield_host_function_executors,
  greenfield_host_function_requests,
  greenfield_module_runtime_credentials,
  greenfield_inter_module_action_requests FROM modula_api, modula_worker;
GRANT SELECT ON greenfield_function_implementations TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE ON greenfield_function_invocations,
  greenfield_function_mutations,
  greenfield_host_function_executors,
  greenfield_host_function_requests,
  greenfield_module_runtime_credentials,
  greenfield_inter_module_action_requests TO modula_api, modula_worker;
GRANT SELECT ON greenfield_function_implementations,
  greenfield_function_invocations,
  greenfield_function_mutations,
  greenfield_host_function_executors,
  greenfield_host_function_requests,
  greenfield_module_runtime_credentials,
  greenfield_inter_module_action_requests TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '070')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
