UPDATE greenfield_mail_jobs
SET template_id = CASE template_id
  WHEN 'verification-code' THEN 'verification'
  WHEN 'verify-email' THEN 'verification'
  WHEN 'passwordless-login' THEN 'new-sign-in'
  WHEN 'contact-email-changed' THEN 'email-changed'
  WHEN 'passkey-added' THEN 'new-sign-in'
  WHEN 'passkey-removed' THEN 'new-sign-in'
  WHEN 'authenticator-enabled' THEN 'new-sign-in'
  WHEN 'authenticator-disabled' THEN 'new-sign-in'
  WHEN 'recovery-used' THEN 'new-sign-in'
  WHEN 'recovery-code-used' THEN 'new-sign-in'
  WHEN 'sessions-revoked' THEN 'new-sign-in'
  WHEN 'mail-forwarding-changed' THEN 'new-sign-in'
  WHEN 'forwarding-changed' THEN 'new-sign-in'
  WHEN 'modula-mail-activated' THEN 'invite'
  WHEN 'account-deletion-requested' THEN 'account-deletion'
  ELSE template_id
END
WHERE template_id IN (
  'verification-code',
  'verify-email',
  'passwordless-login',
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
  'account-deletion-requested'
);

UPDATE schema_metadata
SET value = '036', updated_at = NOW()
WHERE key = 'schema_version';
