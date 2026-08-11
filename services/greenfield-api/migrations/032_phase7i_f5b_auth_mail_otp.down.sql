-- Roll back Phase 7I-F5B auth/mail OTP additions to the Phase 7I-F5 schema surface.

UPDATE greenfield_auth_challenges
SET purpose = 'email_change'
WHERE purpose = 'contact_email_change';

UPDATE greenfield_mail_jobs
SET template_id = CASE template_id
  WHEN 'verification-code' THEN 'verification'
  WHEN 'verify-email' THEN 'verification'
  WHEN 'passwordless-login' THEN 'new-sign-in'
  WHEN 'contact-email-changed' THEN 'email-changed'
  WHEN 'authenticator-enabled' THEN 'new-sign-in'
  WHEN 'authenticator-disabled' THEN 'new-sign-in'
  WHEN 'recovery-code-used' THEN 'recovery-used'
  WHEN 'forwarding-changed' THEN 'mail-forwarding-changed'
  WHEN 'modula-mail-activated' THEN 'invite'
  WHEN 'account-deletion-requested' THEN 'account-deletion'
  ELSE template_id
END
WHERE template_id IN (
  'verification-code',
  'verify-email',
  'passwordless-login',
  'contact-email-changed',
  'authenticator-enabled',
  'authenticator-disabled',
  'recovery-code-used',
  'forwarding-changed',
  'modula-mail-activated',
  'account-deletion-requested'
);

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

ALTER TABLE greenfield_auth_challenges
  DROP CONSTRAINT IF EXISTS greenfield_auth_challenges_purpose_check;

ALTER TABLE greenfield_auth_challenges
  ADD CONSTRAINT greenfield_auth_challenges_purpose_check CHECK (purpose IN (
    'email_verification',
    'email_login',
    'password_reset',
    'email_change',
    'passkey_registration',
    'passkey_authentication',
    'totp_enrollment',
    'step_up',
    'account_recovery'
  ));

DROP INDEX IF EXISTS greenfield_auth_challenges_target_hash_idx;

ALTER TABLE greenfield_auth_challenges
  DROP COLUMN IF EXISTS target_hash;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '031')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
