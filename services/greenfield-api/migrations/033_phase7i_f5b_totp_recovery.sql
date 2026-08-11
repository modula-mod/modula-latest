-- Phase 7I-F5B: safe TOTP replacement enrollment beside existing active MFA.
DROP INDEX IF EXISTS greenfield_auth_methods_totp_active_unique;

CREATE UNIQUE INDEX IF NOT EXISTS greenfield_auth_methods_totp_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'totp' AND state = 'active' AND revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS greenfield_auth_methods_totp_pending_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'totp' AND state = 'pending' AND revoked_at IS NULL;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '033')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
