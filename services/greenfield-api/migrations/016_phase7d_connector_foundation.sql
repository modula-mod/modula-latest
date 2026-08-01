-- Phase 7D-B: connector foundation metadata and connection lifecycle tables.
CREATE TABLE IF NOT EXISTS greenfield_connector_providers (
  provider_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider_type TEXT NOT NULL CHECK (provider_type IN ('first-party','trusted-provider','generic','metadata-only')),
  connector_kinds JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(connector_kinds) = 'array'),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(capabilities) = 'array'),
  authorisation_method TEXT NOT NULL CHECK (authorisation_method IN ('oauth2','api-key','personal-access-token','signed-webhook','none')),
  required_configuration JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(required_configuration) = 'array'),
  configured_status TEXT NOT NULL DEFAULT 'not-configured' CHECK (configured_status IN ('configured','not-configured','invalid')),
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available','unavailable','coming-later')),
  health_status TEXT NOT NULL DEFAULT 'not-checked' CHECK (health_status IN ('not-checked','healthy','degraded','unhealthy','unavailable')),
  icon_ref TEXT NOT NULL,
  privacy_summary TEXT NOT NULL,
  data_access_summary TEXT NOT NULL,
  supported_actions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(supported_actions) = 'array'),
  sync_support JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(sync_support) = 'object'),
  webhook_support JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(webhook_support) = 'object'),
  rate_limit_policy JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rate_limit_policy) = 'object'),
  adapter_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  operational BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (operational = FALSE OR (configured_status = 'configured' AND availability_status = 'available' AND health_status IN ('healthy','degraded') AND adapter_trusted = TRUE))
);
CREATE INDEX IF NOT EXISTS greenfield_connector_providers_kinds_idx
  ON greenfield_connector_providers USING GIN (connector_kinds);
CREATE INDEX IF NOT EXISTS greenfield_connector_providers_capabilities_idx
  ON greenfield_connector_providers USING GIN (capabilities);

CREATE TABLE IF NOT EXISTS greenfield_connections (
  connection_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES greenfield_connector_providers(provider_id),
  display_name TEXT NOT NULL,
  external_account_id TEXT,
  external_account_label TEXT,
  state TEXT NOT NULL DEFAULT 'available' CHECK (state IN ('available','authorising','connected','refreshing','degraded','expired','revoked','disabled','failed','disconnected')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  health_status TEXT NOT NULL DEFAULT 'not-checked' CHECK (health_status IN ('not-checked','healthy','degraded','unhealthy','unavailable')),
  connected_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_connections_account_idx
  ON greenfield_connections(account_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_connections_provider_idx
  ON greenfield_connections(provider_id, state);

CREATE TABLE IF NOT EXISTS greenfield_connection_credentials (
  credential_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES greenfield_connections(connection_id) ON DELETE CASCADE,
  key_version TEXT NOT NULL,
  encrypted_access_token BYTEA,
  encrypted_refresh_token BYTEA,
  encrypted_auxiliary_data BYTEA,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (encrypted_access_token IS NOT NULL OR encrypted_refresh_token IS NOT NULL OR encrypted_auxiliary_data IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS greenfield_connection_credentials_connection_idx
  ON greenfield_connection_credentials(connection_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_connection_scopes (
  scope_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES greenfield_connections(connection_id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(connection_id, scope)
);
CREATE INDEX IF NOT EXISTS greenfield_connection_scopes_connection_idx
  ON greenfield_connection_scopes(connection_id, revoked_at);

CREATE TABLE IF NOT EXISTS greenfield_connection_permissions (
  permission_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES greenfield_connections(connection_id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('requested','granted','denied','revoked')),
  reason TEXT,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, capability)
);
CREATE INDEX IF NOT EXISTS greenfield_connection_permissions_connection_idx
  ON greenfield_connection_permissions(connection_id, state);

CREATE TABLE IF NOT EXISTS greenfield_connection_sync_state (
  sync_state_id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES greenfield_connections(connection_id) ON DELETE CASCADE,
  resource_kind TEXT NOT NULL,
  cursor_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cursor_metadata) = 'object'),
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','queued','syncing','succeeded','failed')),
  last_started_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(connection_id, resource_kind)
);
CREATE INDEX IF NOT EXISTS greenfield_connection_sync_state_connection_idx
  ON greenfield_connection_sync_state(connection_id, status);

CREATE TABLE IF NOT EXISTS greenfield_connection_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  connection_id TEXT REFERENCES greenfield_connections(connection_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_state TEXT CHECK (from_state IS NULL OR from_state IN ('available','authorising','connected','refreshing','degraded','expired','revoked','disabled','failed','disconnected')),
  to_state TEXT CHECK (to_state IS NULL OR to_state IN ('available','authorising','connected','refreshing','degraded','expired','revoked','disabled','failed','disconnected')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_connection_events_account_idx
  ON greenfield_connection_events(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_connection_events_connection_idx
  ON greenfield_connection_events(connection_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connector_providers TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connections TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connection_credentials TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connection_scopes TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connection_permissions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connection_sync_state TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connection_events TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','016') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
