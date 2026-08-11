-- Phase 7I-F5B: OTP-backed auth challenge hardening and transactional mail V3 contract.

ALTER TABLE greenfield_auth_challenges
  ADD COLUMN IF NOT EXISTS target_hash TEXT;

CREATE INDEX IF NOT EXISTS greenfield_auth_challenges_target_hash_idx
  ON greenfield_auth_challenges(purpose, target_hash, state, created_at DESC)
  WHERE target_hash IS NOT NULL;

ALTER TABLE greenfield_auth_challenges
  DROP CONSTRAINT IF EXISTS greenfield_auth_challenges_purpose_check;

ALTER TABLE greenfield_auth_challenges
  ADD CONSTRAINT greenfield_auth_challenges_purpose_check CHECK (purpose IN (
    'email_verification',
    'email_login',
    'password_reset',
    'email_change',
    'contact_email_change',
    'passkey_registration',
    'passkey_authentication',
    'totp_enrollment',
    'step_up',
    'account_recovery'
  ));

ALTER TABLE greenfield_mail_jobs DROP CONSTRAINT IF EXISTS greenfield_mail_jobs_template_id_check;
ALTER TABLE greenfield_mail_jobs ADD CONSTRAINT greenfield_mail_jobs_template_id_check CHECK (template_id IN (
  'verification',
  'verification-code',
  'verify-email',
  'password-reset',
  'password-changed',
  'passwordless-login',
  'new-sign-in',
  'email-changed',
  'contact-email-changed',
  'passkey-added',
  'passkey-removed',
  'authenticator-enabled',
  'authenticator-disabled',
  'recovery-used',
  'recovery-code-used',
  'sessions-revoked',
  'mail-forwarding-changed',
  'forwarding-changed',
  'modula-mail-activated',
  'invite',
  'account-deletion',
  'account-deletion-requested'
));

INSERT INTO greenfield_reserved_handles (handle, reason) VALUES
  ('administrator', 'system'),
  ('postmaster', 'mail-system'),
  ('abuse', 'mail-system'),
  ('security', 'mail-system'),
  ('hello', 'mail-system'),
  ('privacy', 'policy'),
  ('legal', 'policy'),
  ('no-reply', 'mail-system'),
  ('noreply', 'mail-system'),
  ('mailer-daemon', 'mail-system'),
  ('hostmaster', 'mail-system'),
  ('webmaster', 'mail-system'),
  ('smtp', 'mail-system'),
  ('imap', 'mail-system'),
  ('mail', 'mail-system'),
  ('www', 'system'),
  ('billing', 'system'),
  ('accounts', 'system'),
  ('account', 'system'),
  ('greenfield', 'system'),
  ('dimon', 'system'),
  ('gaia', 'system')
ON CONFLICT (handle) DO NOTHING;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '032')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
