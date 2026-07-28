-- Phase 7D-A: logical runtime session persistence.
CREATE TABLE IF NOT EXISTS greenfield_runtime_sessions (
  session_id TEXT PRIMARY KEY,
  session_kind TEXT NOT NULL CHECK (session_kind IN ('module','connector-operation','ai-conversation','ai-tool-run','automation-run')),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  module_id TEXT,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id) ON DELETE SET NULL,
  release_id TEXT REFERENCES greenfield_module_releases(release_id) ON DELETE SET NULL,
  provider_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(provider_ids) = 'array'),
  state TEXT NOT NULL CHECK (state IN ('creating','resolving','preparing','ready','starting','active','suspending','suspended','resuming','stopping','terminated','failed','recovering')),
  compatibility TEXT CHECK (compatibility IS NULL OR compatibility IN ('compatible','degraded','blocked')),
  launch_permission TEXT CHECK (launch_permission IS NULL OR launch_permission IN ('allowed','degraded-only','denied')),
  resolution JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(resolution) = 'object'),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reason_codes) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  failure_code TEXT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  CHECK (
    session_kind <> 'module'
    OR (module_id IS NOT NULL AND installation_id IS NOT NULL AND release_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS greenfield_runtime_sessions_account_idx
  ON greenfield_runtime_sessions(account_id, state, updated_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_runtime_sessions_module_idx
  ON greenfield_runtime_sessions(account_id, module_id, release_id, updated_at DESC)
  WHERE module_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS greenfield_runtime_sessions_provider_idx
  ON greenfield_runtime_sessions USING GIN (provider_ids);

CREATE TABLE IF NOT EXISTS greenfield_runtime_session_events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES greenfield_runtime_sessions(session_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_state TEXT CHECK (from_state IS NULL OR from_state IN ('creating','resolving','preparing','ready','starting','active','suspending','suspended','resuming','stopping','terminated','failed','recovering')),
  to_state TEXT CHECK (to_state IS NULL OR to_state IN ('creating','resolving','preparing','ready','starting','active','suspending','suspended','resuming','stopping','terminated','failed','recovering')),
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reason_codes) = 'array'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_runtime_session_events_session_idx
  ON greenfield_runtime_session_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_runtime_session_events_account_idx
  ON greenfield_runtime_session_events(account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_runtime_sessions TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_runtime_session_events TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','015') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
