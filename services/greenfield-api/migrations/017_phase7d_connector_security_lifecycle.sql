-- Phase 7D-C: connector credential security and OAuth/connection lifecycle.
CREATE TABLE IF NOT EXISTS greenfield_connector_oauth_states (
  state_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES greenfield_connector_providers(provider_id),
  state_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','authorising','consumed','expired','cancelled','failed')),
  redirect_uri TEXT NOT NULL,
  pkce_challenge TEXT,
  pkce_challenge_method TEXT CHECK (pkce_challenge_method IS NULL OR pkce_challenge_method IN ('S256')),
  pkce_verifier_key_version TEXT,
  pkce_verifier_nonce BYTEA,
  pkce_verifier_auth_tag BYTEA,
  pkce_verifier_ciphertext BYTEA,
  idempotency_key TEXT,
  failure_code TEXT,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  authorising_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  replay_detected_at TIMESTAMPTZ,
  consume_attempt_count INTEGER NOT NULL DEFAULT 0,
  CHECK (
    pkce_verifier_ciphertext IS NULL
    OR (
      pkce_verifier_key_version IS NOT NULL
      AND pkce_verifier_nonce IS NOT NULL
      AND pkce_verifier_auth_tag IS NOT NULL
    )
  )
);
CREATE INDEX IF NOT EXISTS greenfield_connector_oauth_states_account_idx
  ON greenfield_connector_oauth_states(account_id, provider_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS greenfield_connector_oauth_states_expiry_idx
  ON greenfield_connector_oauth_states(status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS greenfield_connector_oauth_states_idempotency_idx
  ON greenfield_connector_oauth_states(account_id, provider_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE greenfield_connection_credentials
  ADD COLUMN IF NOT EXISTS encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  ADD COLUMN IF NOT EXISTS nonce BYTEA,
  ADD COLUMN IF NOT EXISTS auth_tag BYTEA,
  ADD COLUMN IF NOT EXISTS encrypted_payload BYTEA;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'greenfield_connection_credentials_envelope_complete'
  ) THEN
    ALTER TABLE greenfield_connection_credentials
      ADD CONSTRAINT greenfield_connection_credentials_envelope_complete
      CHECK (
        encrypted_payload IS NULL
        OR (
          encryption_algorithm = 'AES-256-GCM'
          AND key_version <> ''
          AND nonce IS NOT NULL
          AND auth_tag IS NOT NULL
        )
      );
  END IF;
END $$;

ALTER TABLE greenfield_connections
  ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS health_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
  ADD COLUMN IF NOT EXISTS revoked_by TEXT,
  ADD COLUMN IF NOT EXISTS revocation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(revocation_metadata) = 'object'),
  ADD COLUMN IF NOT EXISTS external_identity_metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(external_identity_metadata) = 'object'),
  ADD COLUMN IF NOT EXISTS last_transition_idempotency_key TEXT;

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_connector_oauth_states TO modula_api, modula_worker;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','017') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
