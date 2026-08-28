-- Greenfield Backend V1: account-wide export and deletion orchestration.

CREATE TABLE greenfield_account_data_requests (
  data_request_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  request_type TEXT NOT NULL CHECK (request_type IN ('EXPORT','DELETE')),
  state TEXT NOT NULL CHECK (state IN ('DISCOVERING','COLLECTING','READY','WAITING_RETENTION','DELETING','COMPLETED','FAILED','CANCELLED')),
  idempotency_key TEXT NOT NULL,
  requested_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  recent_auth_strength TEXT,
  integrity_manifest JSONB CHECK (integrity_manifest IS NULL OR jsonb_typeof(integrity_manifest)='object'),
  not_before TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE(account_id, request_type, idempotency_key),
  CHECK ((request_type='DELETE' AND not_before IS NOT NULL) OR (request_type='EXPORT' AND not_before IS NULL))
);
CREATE INDEX greenfield_account_data_requests_account_idx ON greenfield_account_data_requests(account_id, created_at DESC);

CREATE TABLE greenfield_account_data_request_domains (
  data_request_domain_id TEXT PRIMARY KEY,
  data_request_id TEXT NOT NULL REFERENCES greenfield_account_data_requests(data_request_id) ON DELETE CASCADE,
  domain_key TEXT NOT NULL,
  domain_kind TEXT NOT NULL CHECK (domain_kind IN ('GREENFIELD_CORE','GREENFIELD_RECORDS','MODULE_SERVICE','OBJECT_STORAGE','EXTERNAL_SERVICE')),
  product_id TEXT,
  installation_id TEXT REFERENCES greenfield_extension_installations(installation_id),
  resource_id TEXT REFERENCES greenfield_data_resources(resource_id),
  handler TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('PENDING','CLAIMED','SUCCEEDED','RETAINED','FAILED','SKIPPED')),
  retention_decision TEXT CHECK (retention_decision IS NULL OR retention_decision IN ('DELETE','RETAIN_LEGAL_HOLD','RETAIN_POLICY','NOT_APPLICABLE')),
  claimed_by_service_id TEXT,
  claim_expires_at TIMESTAMPTZ,
  failure_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE(data_request_id, domain_key)
);
CREATE INDEX greenfield_account_data_domains_claim_idx ON greenfield_account_data_request_domains(product_id, state, created_at) WHERE state='PENDING';

CREATE TABLE greenfield_account_data_artifacts (
  artifact_id TEXT PRIMARY KEY,
  data_request_id TEXT NOT NULL REFERENCES greenfield_account_data_requests(data_request_id) ON DELETE CASCADE,
  data_request_domain_id TEXT NOT NULL UNIQUE REFERENCES greenfield_account_data_request_domains(data_request_domain_id) ON DELETE CASCADE,
  artifact_ref TEXT NOT NULL,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type TEXT NOT NULL,
  byte_length BIGINT NOT NULL CHECK (byte_length >= 0),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (payload IS NULL OR jsonb_typeof(payload) IN ('object','array'))
);

CREATE TABLE greenfield_account_deletion_tombstones (
  account_id TEXT PRIMARY KEY REFERENCES greenfield_accounts(account_id),
  data_request_id TEXT NOT NULL UNIQUE REFERENCES greenfield_account_data_requests(data_request_id),
  retained_domains JSONB NOT NULL CHECK (jsonb_typeof(retained_domains)='array'),
  deletion_manifest_sha256 TEXT NOT NULL CHECK (deletion_manifest_sha256 ~ '^[0-9a-f]{64}$'),
  completed_at TIMESTAMPTZ NOT NULL
);

GRANT SELECT, INSERT, UPDATE ON greenfield_account_data_requests, greenfield_account_data_request_domains TO modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_account_data_artifacts, greenfield_account_deletion_tombstones TO modula_api, modula_worker;
GRANT SELECT ON greenfield_account_data_requests, greenfield_account_data_request_domains,
  greenfield_account_data_artifacts, greenfield_account_deletion_tombstones TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '050')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
