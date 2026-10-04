DELETE FROM greenfield_mail_jobs WHERE template_id IN ('digest-weekly', 'digest-morning');
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
  'account-deletion-requested',
  'support-case'
));
DROP TABLE IF EXISTS greenfield_commerce_invoices;
DROP TABLE IF EXISTS greenfield_creator_ledger_entries;
DROP TABLE IF EXISTS greenfield_digest_deliveries;
DROP TABLE IF EXISTS greenfield_account_app_preferences;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '062')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
