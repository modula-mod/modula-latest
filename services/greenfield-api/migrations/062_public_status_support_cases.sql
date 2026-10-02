-- Public service status and in-app support cases. Additive only.

-- Worker liveness. Each worker process upserts its own row on a short interval
-- so the public status endpoint can report real background-processing health.
CREATE TABLE IF NOT EXISTS greenfield_worker_heartbeats (
  worker_id TEXT PRIMARY KEY CHECK (length(worker_id) BETWEEN 1 AND 160),
  release_sha TEXT CHECK (release_sha IS NULL OR length(release_sha) <= 80),
  started_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS greenfield_worker_heartbeats_seen_idx ON greenfield_worker_heartbeats (last_seen_at DESC);

GRANT SELECT ON greenfield_worker_heartbeats TO modula_api, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_worker_heartbeats TO modula_worker;

-- Support cases opened from a signed-in client. The case is delivered to the
-- support mailbox through the existing transactional mail queue.
CREATE TABLE IF NOT EXISTS greenfield_support_cases (
  case_id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE CHECK (reference ~ '^MOD-[0-9A-Z]{8}$'),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  category TEXT NOT NULL CHECK (category IN ('help', 'bug', 'account', 'privacy', 'safety', 'feedback')),
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 3 AND 140),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 10 AND 5000),
  diagnostics JSONB,
  state TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'ANSWERED', 'CLOSED')),
  idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  mail_job_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS greenfield_support_cases_account_idx ON greenfield_support_cases (account_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON greenfield_support_cases TO modula_api;
GRANT SELECT ON greenfield_support_cases TO modula_backup;

-- Allow the support mailbox notification template.
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

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '062')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
