-- Greenfield Backend V1: isolated build-service queue and provenance reconciliation.

ALTER TABLE greenfield_developer_builds
  ADD COLUMN request_id TEXT NOT NULL DEFAULT 'migration-048',
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN maximum_attempts INTEGER NOT NULL DEFAULT 2 CHECK (maximum_attempts BETWEEN 1 AND 5),
  ADD COLUMN lease_owner TEXT,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN failure_code TEXT,
  ADD COLUMN failure_summary TEXT,
  ADD COLUMN manifest_sha256 TEXT CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN sbom_sha256 TEXT CHECK (sbom_sha256 IS NULL OR sbom_sha256 ~ '^[0-9a-f]{64}$'),
  ADD COLUMN licence_inventory_ref TEXT,
  ADD COLUMN provenance_signature TEXT;

ALTER TABLE greenfield_developer_builds DROP CONSTRAINT greenfield_developer_builds_state_check;
ALTER TABLE greenfield_developer_builds ADD CONSTRAINT greenfield_developer_builds_state_check
  CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED','QUARANTINED'));

CREATE UNIQUE INDEX greenfield_developer_builds_idempotency_idx
  ON greenfield_developer_builds(product_id, idempotency_key);
CREATE INDEX greenfield_developer_builds_claim_idx
  ON greenfield_developer_builds(state, created_at)
  WHERE state='QUEUED';

CREATE TABLE greenfield_build_service_registrations (
  service_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  signing_key_id TEXT NOT NULL UNIQUE,
  runner_image TEXT NOT NULL CHECK (runner_image ~ '@sha256:[0-9a-f]{64}$'),
  state TEXT NOT NULL CHECK (state IN ('ACTIVE','DISABLED','QUARANTINED')),
  registered_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_health_at TIMESTAMPTZ
);

CREATE TABLE greenfield_build_provenance (
  build_id TEXT PRIMARY KEY REFERENCES greenfield_developer_builds(build_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES greenfield_build_service_registrations(service_id),
  signing_key_id TEXT NOT NULL,
  source_repository TEXT NOT NULL,
  source_sha TEXT NOT NULL CHECK (source_sha ~ '^[0-9a-f]{40}$'),
  builder_identity TEXT NOT NULL,
  build_profile TEXT NOT NULL,
  artifact_sha256 TEXT NOT NULL CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  sbom_sha256 TEXT NOT NULL CHECK (sbom_sha256 ~ '^[0-9a-f]{64}$'),
  licence_inventory_sha256 TEXT NOT NULL CHECK (licence_inventory_sha256 ~ '^[0-9a-f]{64}$'),
  signature TEXT NOT NULL,
  signature_verified BOOLEAN NOT NULL CHECK (signature_verified=TRUE),
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_build_claim_requests (
  service_id TEXT NOT NULL REFERENCES greenfield_build_service_registrations(service_id),
  request_id TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  response JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(response)='array'),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(service_id, request_id)
);

CREATE TABLE greenfield_build_result_receipts (
  receipt_id TEXT PRIMARY KEY,
  build_id TEXT NOT NULL REFERENCES greenfield_developer_builds(build_id) ON DELETE CASCADE,
  service_id TEXT NOT NULL REFERENCES greenfield_build_service_registrations(service_id),
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  service_signature_verified BOOLEAN NOT NULL,
  result_state TEXT NOT NULL CHECK (result_state IN ('SUCCEEDED','FAILED','CANCELLED','QUARANTINED')),
  failure_code TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(build_id, payload_sha256)
);

CREATE TABLE greenfield_release_review_checks (
  review_check_id TEXT PRIMARY KEY,
  review_submission_id TEXT NOT NULL REFERENCES greenfield_developer_review_submissions(review_submission_id) ON DELETE CASCADE,
  check_kind TEXT NOT NULL CHECK (check_kind IN ('manifest','permissions','network','backend','storage','dependencies','provenance','licence','security','compatibility','export-delete')),
  state TEXT NOT NULL CHECK (state IN ('PENDING','PASS','FAIL','NOT_APPLICABLE')),
  evidence_ref TEXT,
  failure_code TEXT,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_submission_id, check_kind)
);

GRANT SELECT, INSERT, UPDATE ON greenfield_developer_builds, greenfield_build_service_registrations,
  greenfield_build_claim_requests, greenfield_build_result_receipts, greenfield_release_review_checks TO modula_api;
GRANT SELECT, INSERT ON greenfield_build_provenance TO modula_api;
GRANT SELECT ON greenfield_build_service_registrations, greenfield_build_provenance, greenfield_build_claim_requests,
  greenfield_build_result_receipts, greenfield_release_review_checks TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '048')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
