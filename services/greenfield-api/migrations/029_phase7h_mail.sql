-- Phase 7H: transactional mail queue.
CREATE TABLE greenfield_mail_jobs (
  mail_job_id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL CHECK (template_id IN (
    'verification',
    'password-reset',
    'password-changed',
    'new-sign-in',
    'email-changed',
    'invite',
    'account-deletion'
  )),
  recipient_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE SET NULL,
  recipient_address TEXT NOT NULL CHECK (char_length(recipient_address) <= 320),
  recipient_hash TEXT NOT NULL,
  recipient_domain TEXT NOT NULL CHECK (char_length(recipient_domain) <= 253),
  recipient_safe TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  subject TEXT NOT NULL CHECK (char_length(subject) <= 180),
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'retrying', 'dead-letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  maximum_attempts INTEGER NOT NULL DEFAULT 4 CHECK (maximum_attempts > 0),
  provider_message_id TEXT,
  failure_category TEXT CHECK (failure_category IN (
    'temporary',
    'permanent',
    'authentication',
    'rate-limit',
    'DNS',
    'TLS',
    'invalid-recipient'
  )),
  failure_message TEXT,
  correlation_id TEXT,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sending_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  dead_lettered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_mail_jobs_status_available_idx ON greenfield_mail_jobs(status, available_at);
CREATE INDEX greenfield_mail_jobs_recipient_account_idx ON greenfield_mail_jobs(recipient_account_id, created_at DESC);
CREATE INDEX greenfield_mail_jobs_template_idx ON greenfield_mail_jobs(template_id, created_at DESC);
CREATE INDEX greenfield_mail_jobs_correlation_idx ON greenfield_mail_jobs(correlation_id) WHERE correlation_id IS NOT NULL;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '029')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
