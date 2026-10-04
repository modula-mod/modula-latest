-- Settings backend v2. Additive only.
-- Synced app preferences, email digests, mute/block lists (read paths only),
-- creator insights (read paths only), a creator earnings ledger and invoices
-- that start empty (no payment provider is configured), and password step-up.

-- Per-account app preferences that follow the member across devices
-- (feed defaults, digest choices, time & units). Validated by the API.
CREATE TABLE IF NOT EXISTS greenfield_account_app_preferences (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(preferences) = 'object'),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT SELECT, INSERT, UPDATE ON greenfield_account_app_preferences TO modula_api;
GRANT SELECT ON greenfield_account_app_preferences TO modula_worker, modula_backup;

-- One row per digest period per account, so a digest is composed at most once
-- even with several workers. Quiet periods are recorded with no mail job.
CREATE TABLE IF NOT EXISTS greenfield_digest_deliveries (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  digest_kind TEXT NOT NULL CHECK (digest_kind IN ('weekly', 'morning')),
  period_key TEXT NOT NULL CHECK (length(period_key) BETWEEN 6 AND 20),
  outcome TEXT NOT NULL CHECK (outcome IN ('queued', 'quiet', 'no-email')),
  mail_job_id TEXT,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, digest_kind, period_key)
);
CREATE INDEX IF NOT EXISTS greenfield_digest_deliveries_recent_idx ON greenfield_digest_deliveries (account_id, created_at DESC);
GRANT SELECT ON greenfield_digest_deliveries TO modula_api, modula_backup;
GRANT SELECT, INSERT ON greenfield_digest_deliveries TO modula_worker;

-- The digest composer reads engagement counts.
GRANT SELECT ON greenfield_accounts, greenfield_auth_identities, follows, post_likes, greenfield_reactions, greenfield_comments, greenfield_post_shares TO modula_worker;

-- Creator earnings ledger. Append-only and empty until a payment provider is
-- chosen and connected; balances are derived from entries, never stored.
CREATE TABLE IF NOT EXISTS greenfield_creator_ledger_entries (
  entry_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('earning', 'payout', 'refund', 'fee', 'adjustment')),
  amount_minor BIGINT NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 280),
  source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 80),
  source_reference TEXT CHECK (source_reference IS NULL OR length(source_reference) <= 200),
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source, source_reference)
);
CREATE INDEX IF NOT EXISTS greenfield_creator_ledger_account_idx ON greenfield_creator_ledger_entries (account_id, occurred_at DESC);
GRANT SELECT ON greenfield_creator_ledger_entries TO modula_api, modula_backup;

-- Invoices issued to an account. Empty until a payment provider exists.
CREATE TABLE IF NOT EXISTS greenfield_commerce_invoices (
  invoice_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  invoice_number TEXT NOT NULL UNIQUE CHECK (length(invoice_number) BETWEEN 1 AND 60),
  state TEXT NOT NULL CHECK (state IN ('open', 'paid', 'void', 'refunded')),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 280),
  total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider TEXT NOT NULL CHECK (length(provider) BETWEEN 1 AND 40),
  provider_reference TEXT,
  issued_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS greenfield_commerce_invoices_account_idx ON greenfield_commerce_invoices (account_id, issued_at DESC);
GRANT SELECT ON greenfield_commerce_invoices TO modula_api, modula_backup;

-- Digest mail templates.
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
  'support-case',
  'digest-weekly',
  'digest-morning'
));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '063')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
