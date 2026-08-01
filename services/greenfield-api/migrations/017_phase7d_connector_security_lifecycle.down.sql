ALTER TABLE greenfield_connections
  DROP COLUMN IF EXISTS last_transition_idempotency_key,
  DROP COLUMN IF EXISTS external_identity_metadata,
  DROP COLUMN IF EXISTS revocation_metadata,
  DROP COLUMN IF EXISTS revoked_by,
  DROP COLUMN IF EXISTS revocation_reason,
  DROP COLUMN IF EXISTS health_reason_code,
  DROP COLUMN IF EXISTS health_checked_at;

ALTER TABLE greenfield_connection_credentials
  DROP CONSTRAINT IF EXISTS greenfield_connection_credentials_envelope_complete,
  DROP COLUMN IF EXISTS encrypted_payload,
  DROP COLUMN IF EXISTS auth_tag,
  DROP COLUMN IF EXISTS nonce,
  DROP COLUMN IF EXISTS encryption_algorithm;

DROP TABLE IF EXISTS greenfield_connector_oauth_states;
INSERT INTO schema_metadata (key,value) VALUES ('schema_version','016') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
