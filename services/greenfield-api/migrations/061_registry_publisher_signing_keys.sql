-- Registry trust pipeline, step 5: publisher-controlled Ed25519 release signing.
-- The registry stores PUBLIC keys and verification evidence only. Private keys
-- stay with the publisher (CI secret or KMS); nothing here can sign. Additive only.
CREATE TABLE IF NOT EXISTS greenfield_publisher_signing_keys (
  key_id TEXT PRIMARY KEY CHECK (key_id ~ '^[A-Za-z0-9._:-]{3,160}$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  algorithm TEXT NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  public_key_pem TEXT NOT NULL CHECK (public_key_pem LIKE '-----BEGIN PUBLIC KEY-----%' AND public_key_pem NOT LIKE '%PRIVATE KEY%' AND length(public_key_pem) <= 4096),
  fingerprint TEXT NOT NULL UNIQUE CHECK (fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (state IN ('ACTIVE', 'ROTATED', 'REVOKED')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  rotated_to_key_id TEXT REFERENCES greenfield_publisher_signing_keys(key_id),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  registered_by_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK ((state = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK (state <> 'ROTATED' OR rotated_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS greenfield_publisher_signing_keys_publisher_idx ON greenfield_publisher_signing_keys (publisher_id, state);

-- Append-only key lifecycle history (registration, rotation, revocation).
CREATE TABLE IF NOT EXISTS greenfield_publisher_signing_key_events (
  event_id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL REFERENCES greenfield_publisher_signing_keys(key_id),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  event_type TEXT NOT NULL CHECK (event_type IN ('registered', 'rotated', 'revoked')),
  related_key_id TEXT,
  reason TEXT,
  actor_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_publisher_signing_key_events_key_idx ON greenfield_publisher_signing_key_events (key_id, created_at);

CREATE OR REPLACE FUNCTION greenfield_signing_key_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'greenfield_publisher_signing_key_events is append-only';
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS greenfield_signing_key_events_append_only ON greenfield_publisher_signing_key_events;
CREATE TRIGGER greenfield_signing_key_events_append_only BEFORE UPDATE OR DELETE ON greenfield_publisher_signing_key_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_key_events_append_only();

-- Verification evidence on the existing signature rows.
ALTER TABLE greenfield_module_release_signatures
  ADD COLUMN IF NOT EXISTS statement JSONB CHECK (statement IS NULL OR jsonb_typeof(statement) = 'object'),
  ADD COLUMN IF NOT EXISTS statement_sha256 TEXT CHECK (statement_sha256 IS NULL OR statement_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN IF NOT EXISTS verification_state TEXT CHECK (verification_state IS NULL OR verification_state IN ('pending', 'verified', 'invalid', 'unknownKey', 'revokedKey')),
  ADD COLUMN IF NOT EXISTS verification_detail TEXT,
  ADD COLUMN IF NOT EXISTS public_key_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS observed_at TIMESTAMPTZ;

GRANT SELECT ON greenfield_publisher_signing_keys, greenfield_publisher_signing_key_events TO modula_worker, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_publisher_signing_keys TO modula_api;
GRANT SELECT, INSERT ON greenfield_publisher_signing_key_events TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '061')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
