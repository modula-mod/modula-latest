-- Phase 7I-F5B: Modula Mail identity registry and queued provisioner workflow.

CREATE TABLE IF NOT EXISTS greenfield_reserved_identifiers (
  identifier TEXT PRIMARY KEY CHECK (identifier ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$|^[a-z0-9]{3}$'),
  registry_version TEXT NOT NULL,
  applies_to TEXT[] NOT NULL DEFAULT ARRAY['handle', 'mail_local_part'],
  reason TEXT NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ('handle' = ANY(applies_to) OR 'mail_local_part' = ANY(applies_to))
);

INSERT INTO greenfield_reserved_identifiers (identifier, registry_version, applies_to, reason)
SELECT handle, '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], reason
FROM greenfield_reserved_handles
ON CONFLICT (identifier) DO UPDATE
SET
  registry_version = EXCLUDED.registry_version,
  applies_to = EXCLUDED.applies_to,
  reason = EXCLUDED.reason;

INSERT INTO greenfield_reserved_identifiers (identifier, registry_version, applies_to, reason)
VALUES
  ('admin', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('administrator', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('root', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('postmaster', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('abuse', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('security', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('support', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('hello', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('privacy', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('legal', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('no-reply', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('noreply', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('mailer-daemon', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('hostmaster', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('webmaster', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('smtp', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('imap', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('mail', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'mail-reserved'),
  ('api', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('www', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('billing', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('accounts', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('account', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('system', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('modula', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'brand-reserved'),
  ('greenfield', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('dimon', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved'),
  ('gaia', '2026-08-11.phase7i-f5b', ARRAY['handle', 'mail_local_part'], 'system-reserved')
ON CONFLICT (identifier) DO UPDATE
SET
  registry_version = EXCLUDED.registry_version,
  applies_to = EXCLUDED.applies_to,
  reason = EXCLUDED.reason;

CREATE TABLE IF NOT EXISTS greenfield_mail_identities (
  mail_identity_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  contact_identity_id TEXT REFERENCES greenfield_auth_identities(identity_id) ON DELETE SET NULL,
  local_part TEXT NOT NULL CHECK (local_part ~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$|^[a-z0-9]{3}$'),
  domain TEXT NOT NULL DEFAULT 'modula.digital',
  address TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'queued', 'provisioning', 'active', 'suspended', 'released', 'failed', 'adoption_required')),
  provider TEXT,
  provider_reference TEXT,
  forwarding_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  forwarding_destination TEXT,
  forwarding_destination_hash TEXT,
  keep_local_copy BOOLEAN NOT NULL DEFAULT TRUE,
  quota_bytes BIGINT,
  storage_used_bytes BIGINT,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  last_error_code TEXT,
  last_error_message TEXT,
  adopted_at TIMESTAMPTZ,
  provisioned_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (address = local_part || '@' || domain)
);

CREATE UNIQUE INDEX IF NOT EXISTS greenfield_mail_identities_account_active_unique
  ON greenfield_mail_identities(account_id)
  WHERE released_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS greenfield_mail_identities_address_active_unique
  ON greenfield_mail_identities(address)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS greenfield_mail_identities_state_idx
  ON greenfield_mail_identities(state, updated_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_mail_identity_requests (
  request_id TEXT PRIMARY KEY,
  mail_identity_id TEXT NOT NULL REFERENCES greenfield_mail_identities(mail_identity_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('provision', 'adopt', 'suspend', 'resume', 'forward', 'release')),
  state TEXT NOT NULL CHECK (state IN ('queued', 'leased', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'hestia',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  service_actor TEXT,
  operator_intent BOOLEAN NOT NULL DEFAULT FALSE,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 3 CHECK (maximum_attempts > 0),
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS greenfield_mail_identity_requests_state_idx
  ON greenfield_mail_identity_requests(state, created_at);

CREATE INDEX IF NOT EXISTS greenfield_mail_identity_requests_identity_idx
  ON greenfield_mail_identity_requests(mail_identity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS greenfield_mailbox_credentials (
  credential_id TEXT PRIMARY KEY,
  mail_identity_id TEXT NOT NULL REFERENCES greenfield_mail_identities(mail_identity_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  credential_kind TEXT NOT NULL CHECK (credential_kind IN ('imap_smtp_password')),
  secret_hash TEXT NOT NULL,
  encrypted_secret BYTEA,
  encryption_key_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS greenfield_mailbox_credentials_active_unique
  ON greenfield_mailbox_credentials(mail_identity_id, credential_kind)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS greenfield_mail_identity_events (
  event_id TEXT PRIMARY KEY,
  mail_identity_id TEXT REFERENCES greenfield_mail_identities(mail_identity_id) ON DELETE SET NULL,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  actor_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  service_actor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS greenfield_mail_identity_events_identity_idx
  ON greenfield_mail_identity_events(mail_identity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS greenfield_mail_identity_events_account_idx
  ON greenfield_mail_identity_events(account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_reserved_identifiers,
  greenfield_mail_identities,
  greenfield_mail_identity_requests,
  greenfield_mailbox_credentials,
  greenfield_mail_identity_events
TO modula_api, modula_worker;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '034')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
