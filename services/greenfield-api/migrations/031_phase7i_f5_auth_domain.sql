-- Phase 7I-F5: Greenfield authentication domain foundation.
CREATE TABLE greenfield_authentication_methods (
  method_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  method_type TEXT NOT NULL CHECK (method_type IN (
    'passkey',
    'password',
    'email_otp',
    'totp',
    'recovery_code',
    'apple',
    'oidc'
  )),
  display_label TEXT,
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'disabled', 'revoked')),
  strength TEXT NOT NULL CHECK (strength IN ('low', 'medium', 'strong', 'phishing_resistant', 'recovery')),
  verified_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX greenfield_auth_methods_account_idx ON greenfield_authentication_methods(account_id, state, method_type);
CREATE INDEX greenfield_auth_methods_type_idx ON greenfield_authentication_methods(method_type, state);
CREATE UNIQUE INDEX greenfield_auth_methods_password_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'password' AND revoked_at IS NULL;
CREATE UNIQUE INDEX greenfield_auth_methods_email_otp_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'email_otp' AND revoked_at IS NULL;
CREATE UNIQUE INDEX greenfield_auth_methods_totp_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'totp' AND revoked_at IS NULL;
CREATE UNIQUE INDEX greenfield_auth_methods_recovery_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'recovery_code' AND revoked_at IS NULL;
CREATE UNIQUE INDEX greenfield_auth_methods_apple_active_unique
  ON greenfield_authentication_methods(account_id)
  WHERE method_type = 'apple' AND revoked_at IS NULL;

CREATE TABLE greenfield_auth_challenges (
  challenge_id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'email_verification',
    'email_login',
    'password_reset',
    'email_change',
    'passkey_registration',
    'passkey_authentication',
    'totp_enrollment',
    'step_up',
    'account_recovery'
  )),
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  method_id TEXT REFERENCES greenfield_authentication_methods(method_id) ON DELETE SET NULL,
  subject_identifier TEXT,
  challenge_hash TEXT NOT NULL UNIQUE,
  verifier_hash TEXT,
  verifier_hint TEXT,
  delivery_channel TEXT CHECK (delivery_channel IN ('email', 'authenticator', 'webauthn', 'recovery', 'internal')),
  state TEXT NOT NULL CHECK (state IN ('pending', 'verified', 'consumed', 'expired', 'superseded', 'locked')),
  attempt_limit INTEGER NOT NULL DEFAULT 5 CHECK (attempt_limit > 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  rate_limit_key TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX greenfield_auth_challenges_account_idx ON greenfield_auth_challenges(account_id, purpose, state, created_at DESC);
CREATE INDEX greenfield_auth_challenges_subject_idx ON greenfield_auth_challenges(purpose, subject_identifier, state, created_at DESC);
CREATE INDEX greenfield_auth_challenges_rate_limit_idx ON greenfield_auth_challenges(rate_limit_key, purpose, created_at DESC) WHERE rate_limit_key IS NOT NULL;

CREATE TABLE greenfield_auth_challenge_attempts (
  attempt_id TEXT PRIMARY KEY,
  challenge_id TEXT REFERENCES greenfield_auth_challenges(challenge_id) ON DELETE SET NULL,
  account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('succeeded', 'failed', 'expired', 'replayed', 'rate_limited', 'locked')),
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX greenfield_auth_challenge_attempts_challenge_idx ON greenfield_auth_challenge_attempts(challenge_id, created_at DESC);
CREATE INDEX greenfield_auth_challenge_attempts_account_idx ON greenfield_auth_challenge_attempts(account_id, created_at DESC);

CREATE TABLE greenfield_auth_rate_limits (
  rate_limit_key TEXT NOT NULL,
  purpose TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (rate_limit_key, purpose)
);

CREATE TABLE greenfield_totp_credentials (
  totp_id TEXT PRIMARY KEY,
  method_id TEXT NOT NULL UNIQUE REFERENCES greenfield_authentication_methods(method_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  secret_ciphertext TEXT NOT NULL,
  secret_key_id TEXT NOT NULL,
  algorithm TEXT NOT NULL DEFAULT 'SHA1',
  digits INTEGER NOT NULL DEFAULT 6 CHECK (digits BETWEEN 6 AND 8),
  period_seconds INTEGER NOT NULL DEFAULT 30 CHECK (period_seconds BETWEEN 15 AND 90),
  state TEXT NOT NULL CHECK (state IN ('pending', 'active', 'disabled', 'revoked')),
  confirmed_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX greenfield_totp_credentials_account_idx ON greenfield_totp_credentials(account_id, state);

CREATE TABLE greenfield_recovery_code_sets (
  set_id TEXT PRIMARY KEY,
  method_id TEXT NOT NULL REFERENCES greenfield_authentication_methods(method_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK (state IN ('active', 'invalidated', 'exhausted', 'revoked')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_recovery_code_sets_account_idx ON greenfield_recovery_code_sets(account_id, state, generated_at DESC);

CREATE TABLE greenfield_recovery_codes (
  code_id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES greenfield_recovery_code_sets(set_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_recovery_codes_set_idx ON greenfield_recovery_codes(set_id, used_at);
CREATE INDEX greenfield_recovery_codes_account_idx ON greenfield_recovery_codes(account_id, created_at DESC);

CREATE TABLE greenfield_external_identities (
  external_identity_id TEXT PRIMARY KEY,
  method_id TEXT NOT NULL REFERENCES greenfield_authentication_methods(method_id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('apple', 'oidc')),
  provider_subject TEXT NOT NULL,
  provider_issuer TEXT,
  email TEXT,
  email_verified BOOLEAN,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX greenfield_external_identities_provider_subject_unique
  ON greenfield_external_identities(provider, provider_subject)
  WHERE revoked_at IS NULL;
CREATE INDEX greenfield_external_identities_account_idx ON greenfield_external_identities(account_id, provider, revoked_at);

CREATE TABLE greenfield_security_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  session_id TEXT REFERENCES greenfield_sessions(session_id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  method_type TEXT CHECK (method_type IN (
    'passkey',
    'password',
    'email_otp',
    'totp',
    'recovery_code',
    'apple',
    'oidc'
  )),
  method_id TEXT REFERENCES greenfield_authentication_methods(method_id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  ip_hash TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_security_events_account_idx ON greenfield_security_events(account_id, created_at DESC);
CREATE INDEX greenfield_security_events_type_idx ON greenfield_security_events(event_type, created_at DESC);

ALTER TABLE greenfield_passkeys
  ADD COLUMN IF NOT EXISTS method_id TEXT REFERENCES greenfield_authentication_methods(method_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS algorithm TEXT,
  ADD COLUMN IF NOT EXISTS backup_eligible BOOLEAN,
  ADD COLUMN IF NOT EXISTS backup_state BOOLEAN,
  ADD COLUMN IF NOT EXISTS label TEXT,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

ALTER TABLE greenfield_sessions
  ADD COLUMN IF NOT EXISTS recent_authentication_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS authentication_strength TEXT NOT NULL DEFAULT 'medium' CHECK (authentication_strength IN ('low', 'medium', 'strong', 'phishing_resistant', 'recovery')),
  ADD COLUMN IF NOT EXISTS authentication_method_id TEXT REFERENCES greenfield_authentication_methods(method_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT;

INSERT INTO greenfield_authentication_methods (
  method_id,
  account_id,
  method_type,
  display_label,
  state,
  strength,
  verified_at,
  last_used_at,
  created_at,
  updated_at,
  revoked_at,
  metadata
)
SELECT
  'password-' || password.account_id,
  password.account_id,
  'password',
  'Password',
  'active',
  'medium',
  password.updated_at,
  NULL,
  password.updated_at,
  password.updated_at,
  NULL,
  jsonb_build_object('algorithm', COALESCE(password.params->>'algorithm', 'argon2id'))
FROM greenfield_password_credentials password
ON CONFLICT DO NOTHING;

INSERT INTO greenfield_authentication_methods (
  method_id,
  account_id,
  method_type,
  display_label,
  state,
  strength,
  verified_at,
  last_used_at,
  created_at,
  updated_at,
  revoked_at,
  metadata
)
SELECT
  'email-otp-' || identity.account_id,
  identity.account_id,
  'email_otp',
  'Email code',
  CASE WHEN identity.verified_at IS NULL THEN 'pending' ELSE 'active' END,
  'low',
  identity.verified_at,
  NULL,
  identity.created_at,
  identity.updated_at,
  NULL,
  jsonb_build_object('email', identity.identifier)
FROM greenfield_auth_identities identity
WHERE identity.kind = 'email'
ON CONFLICT DO NOTHING;

INSERT INTO greenfield_authentication_methods (
  method_id,
  account_id,
  method_type,
  display_label,
  state,
  strength,
  verified_at,
  last_used_at,
  created_at,
  updated_at,
  revoked_at,
  metadata
)
SELECT
  'passkey-' || passkey.passkey_id,
  passkey.account_id,
  'passkey',
  COALESCE(passkey.label, 'Passkey'),
  CASE WHEN passkey.revoked_at IS NULL THEN 'active' ELSE 'revoked' END,
  'phishing_resistant',
  passkey.created_at,
  passkey.last_used_at,
  passkey.created_at,
  COALESCE(passkey.last_used_at, passkey.created_at),
  passkey.revoked_at,
  jsonb_build_object('transports', passkey.transports, 'backupEligible', passkey.backup_eligible, 'backupState', passkey.backup_state)
FROM greenfield_passkeys passkey
ON CONFLICT DO NOTHING;

UPDATE greenfield_passkeys
SET method_id = 'passkey-' || passkey_id
WHERE method_id IS NULL;

ALTER TABLE greenfield_mail_jobs DROP CONSTRAINT IF EXISTS greenfield_mail_jobs_template_id_check;
ALTER TABLE greenfield_mail_jobs ADD CONSTRAINT greenfield_mail_jobs_template_id_check CHECK (template_id IN (
  'verification',
  'password-reset',
  'password-changed',
  'new-sign-in',
  'email-changed',
  'passkey-added',
  'passkey-removed',
  'recovery-used',
  'sessions-revoked',
  'mail-forwarding-changed',
  'invite',
  'account-deletion'
));

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_authentication_methods,
  greenfield_auth_challenges,
  greenfield_auth_challenge_attempts,
  greenfield_auth_rate_limits,
  greenfield_totp_credentials,
  greenfield_recovery_code_sets,
  greenfield_recovery_codes,
  greenfield_external_identities,
  greenfield_security_events
TO modula_api, modula_worker;

GRANT SELECT ON
  greenfield_authentication_methods,
  greenfield_auth_challenges,
  greenfield_auth_challenge_attempts,
  greenfield_auth_rate_limits,
  greenfield_totp_credentials,
  greenfield_recovery_code_sets,
  greenfield_recovery_codes,
  greenfield_external_identities,
  greenfield_security_events
TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '031')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
