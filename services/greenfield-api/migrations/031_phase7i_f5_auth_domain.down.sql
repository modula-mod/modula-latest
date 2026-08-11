REVOKE SELECT, INSERT, UPDATE, DELETE ON
  greenfield_authentication_methods,
  greenfield_auth_challenges,
  greenfield_auth_challenge_attempts,
  greenfield_auth_rate_limits,
  greenfield_totp_credentials,
  greenfield_recovery_code_sets,
  greenfield_recovery_codes,
  greenfield_external_identities,
  greenfield_security_events
FROM modula_api, modula_worker;

REVOKE SELECT ON
  greenfield_authentication_methods,
  greenfield_auth_challenges,
  greenfield_auth_challenge_attempts,
  greenfield_auth_rate_limits,
  greenfield_totp_credentials,
  greenfield_recovery_code_sets,
  greenfield_recovery_codes,
  greenfield_external_identities,
  greenfield_security_events
FROM modula_backup;

ALTER TABLE greenfield_mail_jobs DROP CONSTRAINT IF EXISTS greenfield_mail_jobs_template_id_check;
ALTER TABLE greenfield_mail_jobs ADD CONSTRAINT greenfield_mail_jobs_template_id_check CHECK (template_id IN (
  'verification',
  'password-reset',
  'password-changed',
  'new-sign-in',
  'email-changed',
  'invite',
  'account-deletion'
));

ALTER TABLE greenfield_sessions
  DROP COLUMN IF EXISTS platform,
  DROP COLUMN IF EXISTS client_name,
  DROP COLUMN IF EXISTS authentication_method_id,
  DROP COLUMN IF EXISTS authentication_strength,
  DROP COLUMN IF EXISTS recent_authentication_at;

ALTER TABLE greenfield_passkeys
  DROP COLUMN IF EXISTS revoked_at,
  DROP COLUMN IF EXISTS label,
  DROP COLUMN IF EXISTS backup_state,
  DROP COLUMN IF EXISTS backup_eligible,
  DROP COLUMN IF EXISTS algorithm,
  DROP COLUMN IF EXISTS method_id;

DROP TABLE IF EXISTS greenfield_security_events;
DROP TABLE IF EXISTS greenfield_external_identities;
DROP TABLE IF EXISTS greenfield_recovery_codes;
DROP TABLE IF EXISTS greenfield_recovery_code_sets;
DROP TABLE IF EXISTS greenfield_totp_credentials;
DROP TABLE IF EXISTS greenfield_auth_rate_limits;
DROP TABLE IF EXISTS greenfield_auth_challenge_attempts;
DROP TABLE IF EXISTS greenfield_auth_challenges;
DROP TABLE IF EXISTS greenfield_authentication_methods;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '030')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
