-- Phase 7E Block 7: module backend runtime integration state.
-- These tables store Greenfield integration metadata only. Module-owned domain
-- data remains in the module backend, customer backend, or device store.

CREATE TABLE IF NOT EXISTS module_backend_definitions (
  definition_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL UNIQUE REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('greenfield-managed','module-managed','hybrid','frontend-only')),
  protocol_version TEXT,
  endpoint_strategy TEXT CHECK (endpoint_strategy IS NULL OR endpoint_strategy IN ('registry','installation','self-hosted','user-configured')),
  discovery_path TEXT,
  health_path TEXT,
  backend JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(backend) = 'object'),
  trust JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(trust) = 'object'),
  data JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  deployment JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(deployment) = 'object'),
  network_policy JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(network_policy) = 'object'),
  actions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(actions) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS module_backend_definitions_module_idx
  ON module_backend_definitions(module_id, mode);

CREATE TABLE IF NOT EXISTS module_backend_installations (
  backend_installation_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL UNIQUE REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('greenfield-managed','module-managed','hybrid','frontend-only')),
  resolved_origin TEXT,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('unconfigured','discovering','verifying','available','degraded','unreachable','incompatible','revoked','quarantined','disabled')),
  protocol_version TEXT,
  discovery JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(discovery) = 'object'),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  verification_status TEXT NOT NULL CHECK (verification_status IN ('not-required','pending','verified','failed','quarantined')),
  verification_errors JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(verification_errors) = 'array'),
  last_verified_at TIMESTAMPTZ,
  last_health_at TIMESTAMPTZ,
  enabled_at TIMESTAMPTZ,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS module_backend_installations_account_idx
  ON module_backend_installations(account_id, module_id, lifecycle_state);

CREATE TABLE IF NOT EXISTS module_backend_sessions (
  session_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  actor_id TEXT,
  audience TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(permissions) = 'array'),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS module_backend_sessions_installation_idx
  ON module_backend_sessions(installation_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS module_backend_health (
  health_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  component TEXT NOT NULL CHECK (component IN ('discovery','identity','tls','protocol','authentication','api','database','queue','events','webhooks','search','storage','gateway')),
  status TEXT NOT NULL CHECK (status IN ('healthy','degraded','unreachable','incompatible','quarantined','disabled')),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  failure_count INTEGER NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  circuit_state TEXT NOT NULL DEFAULT 'closed' CHECK (circuit_state IN ('closed','open','half-open')),
  redacted_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_details) = 'object'),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS module_backend_health_installation_idx
  ON module_backend_health(installation_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS module_backend_capabilities (
  capability_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('greenfield','module-backend','external-connector','local')),
  available BOOLEAN NOT NULL,
  granted BOOLEAN NOT NULL,
  reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, capability, provider)
);

CREATE TABLE IF NOT EXISTS module_backend_event_subscriptions (
  subscription_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('greenfield-to-backend','backend-to-greenfield')),
  allowed BOOLEAN NOT NULL DEFAULT TRUE,
  signature_required BOOLEAN NOT NULL DEFAULT TRUE,
  replay_window_seconds INTEGER NOT NULL DEFAULT 300 CHECK (replay_window_seconds BETWEEN 30 AND 86400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, event_type, direction)
);

CREATE TABLE IF NOT EXISTS module_backend_event_deliveries (
  delivery_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('greenfield-to-backend','backend-to-greenfield')),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','duplicate','rejected','failed','dead_lettered')),
  idempotency_key TEXT,
  payload_hash TEXT NOT NULL,
  failure_code TEXT,
  redacted_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, event_id, direction)
);

CREATE TABLE IF NOT EXISTS module_backend_webhook_deliveries (
  webhook_delivery_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming','outgoing')),
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','duplicate','rejected','failed','dead_lettered')),
  idempotency_key TEXT,
  payload_hash TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  failure_code TEXT,
  redacted_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_details) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(installation_id, webhook_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS module_backend_failures (
  failure_id TEXT PRIMARY KEY,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE SET NULL,
  module_id TEXT NOT NULL,
  failure_type TEXT NOT NULL CHECK (failure_type IN ('discovery','identity','tls','protocol','authentication','gateway','event','webhook','health','network-policy','schema','circuit-breaker')),
  reason_code TEXT NOT NULL,
  redacted_details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(redacted_details) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS module_backend_failures_module_idx
  ON module_backend_failures(module_id, occurred_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','023') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
