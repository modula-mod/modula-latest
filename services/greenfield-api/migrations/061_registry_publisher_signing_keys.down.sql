ALTER TABLE greenfield_module_release_signatures
  DROP COLUMN IF EXISTS observed_at,
  DROP COLUMN IF EXISTS public_key_fingerprint,
  DROP COLUMN IF EXISTS verification_detail,
  DROP COLUMN IF EXISTS verification_state,
  DROP COLUMN IF EXISTS statement_sha256,
  DROP COLUMN IF EXISTS statement;
DROP TABLE IF EXISTS greenfield_publisher_signing_key_events;
DROP FUNCTION IF EXISTS greenfield_signing_key_events_append_only();
DROP TABLE IF EXISTS greenfield_publisher_signing_keys;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '060')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
