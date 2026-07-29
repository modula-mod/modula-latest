-- Phase 7E Block 9: Greenfield AI provider runtime and secure execution gateway.
-- This keeps Block 8's greenfield_ai_request_ledger as the authoritative
-- completed-usage ledger and adds execution, credential, health, stream replay,
-- circuit, quota and runtime tables around it.

ALTER TABLE greenfield_ai_providers
  DROP CONSTRAINT IF EXISTS greenfield_ai_providers_configuration_mode_check;

ALTER TABLE greenfield_ai_providers
  ADD CONSTRAINT greenfield_ai_providers_configuration_mode_check
  CHECK (configuration_mode IN (
    'disabled',
    'platform-managed',
    'customer-managed',
    'local',
    'development-mock',
    'server-managed',
    'account-managed',
    'local-runtime',
    'future'
  ));

INSERT INTO greenfield_ai_providers (
  provider_id,
  provider_kind,
  display_name,
  status,
  configuration_mode,
  capabilities,
  metadata
) VALUES
  ('provider:development-mock', 'local', 'Development Mock Provider', 'available', 'development-mock', '["chat","text-generation","streaming","structured-output","tool-calling"]'::jsonb, '{"managedBy":"greenfield-ai-provider-runtime","deterministic":true}'::jsonb),
  ('provider:ollama', 'ollama', 'Ollama Local Runtime', 'unconfigured', 'local', '["chat","text-generation","streaming","structured-output"]'::jsonb, '{"managedBy":"greenfield-ai-provider-runtime","local":true}'::jsonb)
ON CONFLICT (provider_id) DO UPDATE SET
  provider_kind=EXCLUDED.provider_kind,
  display_name=EXCLUDED.display_name,
  configuration_mode=EXCLUDED.configuration_mode,
  capabilities=EXCLUDED.capabilities,
  metadata=EXCLUDED.metadata,
  updated_at=NOW();

INSERT INTO greenfield_ai_models (
  model_id,
  provider_id,
  provider_kind,
  provider_model_id,
  display_name,
  capabilities,
  supports_streaming,
  supports_structured_outputs,
  supports_reasoning,
  supports_vision,
  supports_image_generation,
  supports_embeddings,
  supports_audio,
  availability,
  lifecycle_status,
  enabled,
  policy_tags,
  limits
) VALUES
  ('greenfield.mock.deterministic', 'provider:development-mock', 'local', 'mock-deterministic-v1', 'Deterministic Mock Model', '["chat","text-generation","streaming","structured-output","tool-calling"]'::jsonb, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'available', 'active', TRUE, '["development-mock","deterministic"]'::jsonb, '{"maxInputUnits":4096,"maxOutputUnits":512}'::jsonb),
  ('greenfield.ollama.local', 'provider:ollama', 'ollama', 'configured-by-admin', 'Ollama Local Model', '["chat","text-generation","streaming","structured-output"]'::jsonb, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, FALSE, 'unavailable', 'preview', FALSE, '["local-runtime-required"]'::jsonb, '{"maxInputUnits":8192,"maxOutputUnits":1024}'::jsonb)
ON CONFLICT (model_id) DO UPDATE SET
  provider_id=EXCLUDED.provider_id,
  provider_kind=EXCLUDED.provider_kind,
  provider_model_id=EXCLUDED.provider_model_id,
  display_name=EXCLUDED.display_name,
  capabilities=EXCLUDED.capabilities,
  supports_streaming=EXCLUDED.supports_streaming,
  supports_structured_outputs=EXCLUDED.supports_structured_outputs,
  supports_reasoning=EXCLUDED.supports_reasoning,
  supports_vision=EXCLUDED.supports_vision,
  supports_image_generation=EXCLUDED.supports_image_generation,
  supports_embeddings=EXCLUDED.supports_embeddings,
  supports_audio=EXCLUDED.supports_audio,
  availability=EXCLUDED.availability,
  lifecycle_status=EXCLUDED.lifecycle_status,
  enabled=EXCLUDED.enabled,
  policy_tags=EXCLUDED.policy_tags,
  limits=EXCLUDED.limits,
  updated_at=NOW();

CREATE TABLE IF NOT EXISTS ai_provider_credentials (
  credential_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES greenfield_ai_providers(provider_id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','organisation','account','development')),
  scope_id TEXT,
  encrypted_payload BYTEA NOT NULL,
  encryption_key_version TEXT NOT NULL,
  nonce BYTEA NOT NULL,
  authentication_tag BYTEA NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','unverified','verification_failed','rotated','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  last_verification_code TEXT
);
CREATE INDEX IF NOT EXISTS ai_provider_credentials_scope_idx
  ON ai_provider_credentials(provider_id, scope_type, scope_id, status);

CREATE TABLE IF NOT EXISTS ai_provider_runtime_state (
  state_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES greenfield_ai_providers(provider_id) ON DELETE CASCADE,
  model_id TEXT REFERENCES greenfield_ai_models(model_id) ON DELETE CASCADE,
  circuit_state TEXT NOT NULL CHECK (circuit_state IN ('closed','open','half-open')),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  rolling_window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  circuit_opened_at TIMESTAMPTZ,
  half_open_probe_count INTEGER NOT NULL DEFAULT 0 CHECK (half_open_probe_count >= 0),
  last_failure_code TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(provider_id, model_id)
);
CREATE INDEX IF NOT EXISTS ai_provider_runtime_state_circuit_idx
  ON ai_provider_runtime_state(provider_id, model_id, circuit_state);

CREATE TABLE IF NOT EXISTS ai_executions (
  execution_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES greenfield_ai_request_ledger(request_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  provider_id TEXT REFERENCES greenfield_ai_providers(provider_id) ON DELETE SET NULL,
  model_id TEXT REFERENCES greenfield_ai_models(model_id) ON DELETE SET NULL,
  prompt_id TEXT,
  prompt_version TEXT,
  status TEXT NOT NULL CHECK (status IN ('accepted','running','completed','failed','cancelled','denied')),
  streaming BOOLEAN NOT NULL DEFAULT FALSE,
  structured_output BOOLEAN NOT NULL DEFAULT FALSE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_code TEXT,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_metadata) = 'object'),
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(response_metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_executions_account_idx
  ON ai_executions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_executions_module_idx
  ON ai_executions(module_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_execution_attempts (
  attempt_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES ai_executions(execution_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES greenfield_ai_providers(provider_id) ON DELETE RESTRICT,
  model_id TEXT NOT NULL REFERENCES greenfield_ai_models(model_id) ON DELETE RESTRICT,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','cancelled')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  failure_code TEXT,
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  request_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_metadata) = 'object'),
  response_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(response_metadata) = 'object'),
  UNIQUE(execution_id, attempt_number)
);
CREATE INDEX IF NOT EXISTS ai_execution_attempts_execution_idx
  ON ai_execution_attempts(execution_id, attempt_number);

CREATE TABLE IF NOT EXISTS ai_stream_sessions (
  stream_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES ai_executions(execution_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  module_id TEXT NOT NULL,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  cursor TEXT NOT NULL DEFAULT '0',
  reconnect_token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','reconnecting','completed','cancelled','failed')),
  last_event_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_event_sequence >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  cancellation_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_stream_sessions_execution_idx
  ON ai_stream_sessions(execution_id);
CREATE INDEX IF NOT EXISTS ai_stream_sessions_account_idx
  ON ai_stream_sessions(account_id, expires_at);

CREATE TABLE IF NOT EXISTS ai_stream_events (
  event_id TEXT PRIMARY KEY,
  stream_id TEXT NOT NULL REFERENCES ai_stream_sessions(stream_id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  event_type TEXT NOT NULL CHECK (event_type IN ('execution.started','content.delta','reasoning.status','tool.requested','usage.updated','execution.completed','execution.failed','execution.cancelled','heartbeat')),
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(stream_id, sequence)
);
CREATE INDEX IF NOT EXISTS ai_stream_events_replay_idx
  ON ai_stream_events(stream_id, sequence);

CREATE TABLE IF NOT EXISTS ai_provider_health (
  health_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES greenfield_ai_providers(provider_id) ON DELETE CASCADE,
  model_id TEXT REFERENCES greenfield_ai_models(model_id) ON DELETE CASCADE,
  component TEXT NOT NULL CHECK (component IN ('configuration','credentials','network','model-discovery','execution','streaming','structured-output')),
  state TEXT NOT NULL CHECK (state IN ('healthy','degraded','rate-limited','authentication-failed','unavailable','disabled','unknown')),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  failure_code TEXT,
  failure_rate NUMERIC(6,5) NOT NULL DEFAULT 0 CHECK (failure_rate >= 0),
  rate_limit_state JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rate_limit_state) = 'object'),
  configured_model_count INTEGER NOT NULL DEFAULT 0 CHECK (configured_model_count >= 0),
  successful_execution_count INTEGER NOT NULL DEFAULT 0 CHECK (successful_execution_count >= 0),
  failed_execution_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_execution_count >= 0),
  active_stream_count INTEGER NOT NULL DEFAULT 0 CHECK (active_stream_count >= 0),
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(diagnostics) = 'object')
);
CREATE INDEX IF NOT EXISTS ai_provider_health_provider_idx
  ON ai_provider_health(provider_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_limits (
  limit_id TEXT PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','organisation','account','module','installation','provider','model')),
  scope_id TEXT,
  provider_id TEXT REFERENCES greenfield_ai_providers(provider_id) ON DELETE CASCADE,
  model_id TEXT REFERENCES greenfield_ai_models(model_id) ON DELETE CASCADE,
  limit_kind TEXT NOT NULL CHECK (limit_kind IN ('requests-per-minute','concurrent-executions','daily-input-units','daily-output-units','estimated-spend','single-request-size')),
  unit TEXT NOT NULL CHECK (unit IN ('request','execution','input-token','output-token','context-byte','minor-currency-unit')),
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  limit_value BIGINT NOT NULL CHECK (limit_value >= 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ai_usage_limits_scope_idx
  ON ai_usage_limits(scope_type, scope_id, enabled);

CREATE TABLE IF NOT EXISTS ai_quota_consumption (
  consumption_id TEXT PRIMARY KEY,
  limit_id TEXT REFERENCES ai_usage_limits(limit_id) ON DELETE SET NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('platform','organisation','account','module','installation','provider','model')),
  scope_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  bucket_start TIMESTAMPTZ NOT NULL,
  bucket_end TIMESTAMPTZ NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('request','execution','input-token','output-token','context-byte','minor-currency-unit')),
  consumed_units BIGINT NOT NULL DEFAULT 0 CHECK (consumed_units >= 0),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  currency TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(limit_id, scope_type, scope_id, provider_id, model_id, bucket_start, unit)
);
CREATE INDEX IF NOT EXISTS ai_quota_consumption_scope_idx
  ON ai_quota_consumption(scope_type, scope_id, bucket_start);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_provider_credentials TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_provider_runtime_state TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_executions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_execution_attempts TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_stream_sessions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_stream_events TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_provider_health TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_usage_limits TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_quota_consumption TO modula_api, modula_worker;

INSERT INTO schema_metadata (key,value) VALUES ('schema_version','025')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
