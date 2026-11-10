-- GREENFIELD-SIGNER-01: publisher-scoped online signing authority.
-- Private keys remain inside the configured signing provider. PostgreSQL holds
-- only public keys, provider references, authorization policy and audit facts.

CREATE TABLE greenfield_publisher_online_signing_identities (
  identity_id TEXT PRIMARY KEY CHECK (identity_id ~ '^psi_[0-9a-f-]{36}$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  signing_key_id TEXT NOT NULL UNIQUE REFERENCES greenfield_publisher_signing_keys(key_id),
  provider TEXT NOT NULL CHECK (provider IN ('VAULT_TRANSIT', 'DISPOSABLE_TEST')),
  provider_key_ref TEXT NOT NULL CHECK (provider_key_ref ~ '^[A-Za-z0-9._:/-]{3,240}$' AND provider_key_ref NOT LIKE '%PRIVATE KEY%'),
  purpose TEXT NOT NULL CHECK (purpose IN ('PUBLISHER', 'MODULA_FIRST_PARTY')),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  first_party_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  suspended_at TIMESTAMPTZ,
  suspension_reason TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_key_ref),
  CHECK (valid_until > valid_from AND valid_until <= valid_from + INTERVAL '397 days'),
  CHECK ((state = 'SUSPENDED') = (suspended_at IS NOT NULL)),
  CHECK ((state = 'REVOKED') = (revoked_at IS NOT NULL)),
  CHECK (purpose <> 'MODULA_FIRST_PARTY' OR first_party_authorized),
  CHECK (provider <> 'DISPOSABLE_TEST' OR provider_key_ref LIKE 'test/%')
);
CREATE UNIQUE INDEX greenfield_online_signing_identity_active_purpose_idx
  ON greenfield_publisher_online_signing_identities (publisher_id, purpose)
  WHERE state = 'ACTIVE';
CREATE INDEX greenfield_online_signing_identity_state_idx
  ON greenfield_publisher_online_signing_identities (publisher_id, state, valid_until);

-- Signing is an explicit grant, separate from general publisher ownership.
-- First-party grants are independently marked and cannot be inferred from a
-- manifest, account handle or publisher ownership alone.
CREATE TABLE greenfield_publisher_signing_authorizations (
  authorization_id TEXT PRIMARY KEY CHECK (authorization_id ~ '^psa_[0-9a-f-]{36}$'),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  product_id TEXT NOT NULL REFERENCES greenfield_developer_products(product_id),
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
  first_party_authorized BOOLEAN NOT NULL DEFAULT FALSE,
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  granted_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  suspended_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK ((state = 'SUSPENDED') = (suspended_at IS NOT NULL)),
  CHECK ((state = 'REVOKED') = (revoked_at IS NOT NULL)),
  UNIQUE (publisher_id, product_id, account_id)
);
CREATE INDEX greenfield_publisher_signing_authorizations_subject_idx
  ON greenfield_publisher_signing_authorizations (account_id, state, valid_until);

-- Immutable signing/security audit trail. Receipt/details contain public facts
-- and hashes only; private keys and arbitrary payload bytes are prohibited.
CREATE TABLE greenfield_publisher_signing_audit_events (
  event_id TEXT PRIMARY KEY CHECK (event_id ~ '^psae_[0-9a-f-]{36}$'),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'identity_registered', 'identity_suspended', 'identity_resumed', 'identity_rotated', 'identity_revoked',
    'signing_requested', 'signing_started', 'release_invalidated', 'signature_created',
    'signature_verified', 'signing_failed', 'publication_authorized'
  )),
  job_id TEXT REFERENCES greenfield_publisher_release_jobs(job_id),
  identity_id TEXT REFERENCES greenfield_publisher_online_signing_identities(identity_id),
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id),
  module_id TEXT,
  actor_account_id TEXT REFERENCES greenfield_accounts(account_id),
  approval_sha256 TEXT CHECK (approval_sha256 IS NULL OR approval_sha256 ~ '^[0-9a-f]{64}$'),
  statement_sha256 TEXT CHECK (statement_sha256 IS NULL OR statement_sha256 ~ '^[0-9a-f]{64}$'),
  receipt JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(receipt) = 'object' AND position('PRIVATE KEY' in receipt::text) = 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object' AND position('PRIVATE KEY' in details::text) = 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_publisher_signing_audit_job_idx
  ON greenfield_publisher_signing_audit_events (job_id, created_at);
CREATE INDEX greenfield_publisher_signing_audit_rate_idx
  ON greenfield_publisher_signing_audit_events (actor_account_id, event_type, created_at);
CREATE OR REPLACE FUNCTION greenfield_publisher_signing_audit_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'greenfield_publisher_signing_audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_publisher_signing_audit_append_only
  BEFORE UPDATE OR DELETE ON greenfield_publisher_signing_audit_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_publisher_signing_audit_append_only();

ALTER TABLE greenfield_publisher_release_jobs
  ADD COLUMN approved_facts JSONB CHECK (approved_facts IS NULL OR (jsonb_typeof(approved_facts) = 'object' AND position('PRIVATE KEY' in approved_facts::text) = 0)),
  ADD COLUMN approval_sha256 TEXT CHECK (approval_sha256 IS NULL OR approval_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN signing_request_id TEXT UNIQUE CHECK (signing_request_id IS NULL OR signing_request_id ~ '^psr_[0-9a-f-]{36}$'),
  ADD COLUMN signing_idempotency_key TEXT CHECK (signing_idempotency_key IS NULL OR length(signing_idempotency_key) BETWEEN 1 AND 180),
  ADD COLUMN sign_requested_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  ADD COLUMN signing_identity_id TEXT REFERENCES greenfield_publisher_online_signing_identities(identity_id),
  ADD COLUMN signing_started_at TIMESTAMPTZ,
  ADD COLUMN signed_at TIMESTAMPTZ,
  ADD COLUMN signing_receipt JSONB CHECK (signing_receipt IS NULL OR (jsonb_typeof(signing_receipt) = 'object' AND position('PRIVATE KEY' in signing_receipt::text) = 0));

ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_state_check;
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_state_check CHECK (state IN (
  'created', 'fetching', 'validating', 'signature_missing', 'signature_invalid', 'ready_for_signing', 'signing',
  'signature_verified', 'signing_failed', 'validation_failed', 'ready_for_review', 'publishing', 'published',
  'cancelled', 'failed', 'conflicted'
));
ALTER TABLE greenfield_publisher_release_jobs DROP CONSTRAINT IF EXISTS greenfield_publisher_release_jobs_cancelled_from_state_check;
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_cancelled_from_state_check CHECK (cancelled_from_state IS NULL OR cancelled_from_state IN (
  'created', 'fetching', 'validating', 'signature_verified', 'ready_for_signing', 'signing', 'signing_failed',
  'ready_for_review', 'publishing', 'signature_missing', 'signature_invalid', 'validation_failed', 'failed'
));
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_approval_check CHECK (
  (approved_at IS NULL AND approval_sha256 IS NULL AND approved_facts IS NULL)
  OR (approved_at IS NOT NULL AND approval_sha256 IS NOT NULL AND approved_facts IS NOT NULL)
);
ALTER TABLE greenfield_publisher_release_jobs ADD CONSTRAINT greenfield_publisher_release_jobs_receipt_fields_check CHECK (
  signing_receipt IS NULL OR (signed_at IS NOT NULL AND signing_identity_id IS NOT NULL)
);

DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_tag_idx;
DROP INDEX IF EXISTS greenfield_publisher_release_jobs_inflight_version_idx;
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_tag_idx
  ON greenfield_publisher_release_jobs (module_id, release_tag)
  WHERE state IN ('created', 'fetching', 'validating', 'ready_for_signing', 'signing', 'signature_verified', 'ready_for_review', 'publishing');
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_inflight_version_idx
  ON greenfield_publisher_release_jobs (module_id, version)
  WHERE version IS NOT NULL AND state IN ('created', 'fetching', 'validating', 'ready_for_signing', 'signing', 'signature_verified', 'ready_for_review', 'publishing');
CREATE UNIQUE INDEX greenfield_publisher_release_jobs_signing_idempotency_idx
  ON greenfield_publisher_release_jobs (sign_requested_by_account_id, signing_idempotency_key)
  WHERE signing_idempotency_key IS NOT NULL;

GRANT SELECT ON greenfield_publisher_online_signing_identities, greenfield_publisher_signing_authorizations,
  greenfield_publisher_signing_audit_events TO modula_backup;
GRANT SELECT, INSERT ON greenfield_publisher_signing_audit_events TO modula_worker;
GRANT SELECT ON greenfield_publisher_online_signing_identities, greenfield_publisher_signing_authorizations TO modula_worker;
GRANT SELECT ON greenfield_publisher_online_signing_identities, greenfield_publisher_signing_authorizations TO modula_api;
GRANT SELECT, INSERT ON greenfield_publisher_signing_audit_events TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '089')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
